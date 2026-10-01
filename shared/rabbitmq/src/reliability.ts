import type { ConsumeMessage } from 'amqplib';
import type { RabbitMQClient } from './rabbitmq.client';

/**
 * Shared reliability primitives for queue consumers.
 *
 * Every consumer on the platform follows the same contract (see
 * `ReliableConsumer` in ./reliableConsumer.ts): a message is acknowledged only
 * after the handler succeeded; failures are retried through broker-side delays
 * and, once the policy gives up, land in a park queue (or are dropped) — they
 * are never silently lost. The `in-place` strategy is the strict-ordering
 * exception: it never gives up and never moves on — the queue is held and the
 * same message is retried until it succeeds. The strategies below are the
 * retry mechanics used across the services; everything else is per-consumer
 * configuration.
 */

/** All errors in the `cause` chain (services wrap low-level errors). */
export function errorChain(error: unknown): Array<Record<string, any>> {
  const chain: Array<Record<string, any>> = [];
  let current = error as Record<string, any> | null | undefined;
  for (let i = 0; i < 10 && current; i++) {
    chain.push(current);
    current = current.cause as Record<string, any> | undefined;
  }
  return chain;
}

const TRANSIENT_ERROR_NAMES = new Set([
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
  'MongoExpiredSessionError',
  'MongoPoolClosedError',
]);

const TRANSIENT_MESSAGE_PATTERNS = [
  /buffering timed out/i,
  /replica set member or mongos/i, // transactions attempted on a standalone deployment
  /server selection timed out/i,
  /topology is closed/i,
  /client must be connected/i,
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket hang up|connection .* closed/i,
];

/**
 * Infrastructure failures that resolve by themselves (database temporarily
 * unavailable, connection reset, replica set still booting). Such errors must
 * never push a message into the manual-review queue.
 */
export function isTransientDbError(error: unknown): boolean {
  return errorChain(error).some((e) => {
    const name = typeof e.name === 'string' ? e.name : '';
    const message = typeof e.message === 'string' ? e.message : '';
    return TRANSIENT_ERROR_NAMES.has(name) || TRANSIENT_MESSAGE_PATTERNS.some((p) => p.test(message));
  });
}

/** True when any error in the cause chain carries the given application code. */
export function hasErrorCode(error: unknown, code: string | number): boolean {
  return errorChain(error).some((e) => e.code === code);
}

export interface RetryBucketStep {
  queue: string;
  ttlMs: number;
}

/**
 * How failed messages are retried:
 * - `dlx`: nack(requeue=false) → the broker dead-letters the message into the
 *   retry queue (`<queue>.retry`), which returns it after its TTL. Attempts
 *   are counted from `x-death`; transient infrastructure errors keep cycling
 *   without counting towards exhaustion.
 * - `buckets`: the message is re-published with an incremented attempt number
 *   into the bucket queue for the current attempt (used for long backoff
 *   schedules); the handler decides when attempts are exhausted.
 * - `immediate-once`: requeue(true) once (the broker redelivers right away);
 *   a failure on an already-redelivered message counts as exhausted.
 * - `in-place`: strict ordering — the message is never nacked: it stays
 *   unacknowledged and the handler is re-run for the same message with an
 *   exponential backoff (`delayMs`, doubling up to `maxDelayMs`) until it
 *   succeeds; new messages keep accumulating in the queue behind it
 *   (prefetch=1). Never exhausted: a permanently failing message blocks the
 *   queue on purpose (blockchain events must be applied in chain order).
 */
export type RetryStrategy =
  | { mode: 'dlx'; retryQueue: string; maxAttempts: number }
  | { mode: 'buckets'; steps: readonly RetryBucketStep[]; attemptField?: string }
  | { mode: 'immediate-once' }
  | { mode: 'in-place'; delayMs: number; maxDelayMs?: number };

/** Where messages that cannot be processed any further end up. */
export type ParkStrategy =
  | { mode: 'dlx' } // nack(requeue=false) → the queue's own dead-letter setup
  | { mode: 'envelope'; queue: string }; // publish { reason, parkedAt, content } and ack

export interface ReliabilityPolicy {
  retry: RetryStrategy;
  /** What happens when retries are exhausted or a permanent error is seen. */
  exhausted: 'park' | 'drop';
  park?: ParkStrategy;
  /** Infrastructure hiccups: retried without counting towards exhaustion. */
  isTransient?: (error: unknown) => boolean;
  /** Errors that can never succeed: skip straight to the exhausted action. */
  isPermanent?: (error: unknown) => boolean;
  /** Metric names (the `queue` label is added automatically). */
  metricNames?: {
    retried?: string;
    transientRetried?: string;
    parked?: string;
    dropped?: string;
  };
}

/** How many times this message has already passed through the retry queue. */
export function getRetryCount(message: ConsumeMessage, retryQueueName: string): number {
  const xDeath = (message.properties.headers?.['x-death'] ?? []) as Array<{ queue?: string; count?: number }>;
  const retryEntry = xDeath.find((entry) => entry.queue === retryQueueName);
  return retryEntry?.count ? Number(retryEntry.count) : 0;
}

/** The attempt number carried in the message body (buckets mode). */
export function getMessageAttempt(message: ConsumeMessage, field: string): number {
  try {
    const parsed = JSON.parse(message.content.toString());
    const value = Number(parsed?.[field]);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Declares the standard retry topology of a queue: the main queue dead-letters
 * failed messages into `<queue>.retry` (held there for the TTL and returned
 * through the default exchange), and `<queue>.parked` keeps messages that
 * exhausted all retries. `mainQueueArguments` carries queue-specific options
 * (e.g. a TTL of its own) that must stay on the main queue.
 */
export async function setupDlxRetryTopology(
  rabbitClient: RabbitMQClient,
  queueName: string,
  retryDelayMs: number,
  mainQueueArguments: Record<string, unknown> = {},
): Promise<{ retryExchange: string; retryQueue: string; parkQueue: string }> {
  const retryExchange = `${queueName}.retry.exchange`;
  const retryQueue = `${queueName}.retry`;
  const retryRoutingKey = `${queueName}.retry`;
  const parkQueue = `${queueName}.parked`;

  await rabbitClient.setupExchange(retryExchange, 'direct', { durable: true });

  await rabbitClient.setupQueue(queueName, {
    durable: true,
    arguments: {
      ...mainQueueArguments,
      'x-dead-letter-exchange': retryExchange,
      'x-dead-letter-routing-key': retryRoutingKey,
    },
  });

  await rabbitClient.setupQueue(retryQueue, {
    durable: true,
    arguments: {
      'x-message-ttl': retryDelayMs,
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': queueName,
    },
  });

  await rabbitClient.setupQueue(parkQueue, { durable: true });

  await rabbitClient.bindQueue(retryQueue, retryExchange, retryRoutingKey);

  return { retryExchange, retryQueue, parkQueue };
}
