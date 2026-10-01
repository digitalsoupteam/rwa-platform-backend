import type { ConsumeMessage } from 'amqplib';
import type { RabbitMQClient } from './rabbitmq.client';
import { getMessageAttempt, getRetryCount, type ReliabilityPolicy, type RetryStrategy } from './reliability';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { metrics } from '@shared/monitoring/src/metrics';

/** Promise-based pause for the in-place retry backoff. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The single reliability contract for every queue consumer on the platform.
 *
 * A handler processes one message and returns an outcome:
 * - `done` — the work is finished, acknowledge;
 * - `retry` — the work failed but may succeed later; retried through the
 *   policy's mechanism (broker delay, backoff bucket, one immediate
 *   redelivery, or in place for strict ordering);
 * - `park { reason }` — the message cannot be processed any further; parked
 *   for manual inspection (or passed to the queue's dead-letter setup);
 * - `drop { reason }` — the message is knowingly discarded (logged + metric).
 *
 * A handler may also just throw: the policy maps the error to an outcome —
 * transient infrastructure errors are retried without counting towards
 * exhaustion, everything else is retried until the attempts run out and then
 * goes through the exhausted action. Returning `undefined` is `done`.
 *
 * With the `in-place` retry policy (strict ordering for blockchain events) a
 * thrown error is never mapped to nack/park: the message stays unacknowledged
 * and the handler is re-run for the same message until it succeeds.
 */
export type ConsumeOutcome =
  | { kind: 'done' }
  | { kind: 'retry'; transient?: boolean }
  | { kind: 'park'; reason: string }
  | { kind: 'drop'; reason: string };

/** Shorthand for the common "finished" outcome. */
export const done: ConsumeOutcome = { kind: 'done' };

export class ReliableConsumer {
  /**
   * Serializes in-place processing (strict-ordering mode): the next message
   * is not processed until the full retry loop of the current one finishes,
   * even if more than one message is ever delivered concurrently.
   */
  private inPlaceChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly rabbitClient: RabbitMQClient,
    private readonly queueName: string,
    private readonly policy: ReliabilityPolicy,
  ) {}

  async consume(
    handler: (message: ConsumeMessage) => Promise<ConsumeOutcome | void>,
    options?: { prefetch?: number },
  ): Promise<void> {
    await this.rabbitClient.consume(
      this.queueName,
      async (message: ConsumeMessage | null) => {
        if (!message) return;

        if (this.policy.retry.mode === 'in-place') {
          const run = this.inPlaceChain.then(() => this.handleMessage(message, handler));
          this.inPlaceChain = run.then(
            () => undefined,
            () => undefined,
          );
          await run;
          return;
        }

        await this.handleMessage(message, handler);
      },
      { noAck: false, ...(options?.prefetch !== undefined ? { prefetch: options.prefetch } : {}) },
    );
  }

  private async handleMessage(
    message: ConsumeMessage,
    handler: (message: ConsumeMessage) => Promise<ConsumeOutcome | void>,
  ): Promise<void> {
    const retry = this.policy.retry;
    if (retry.mode === 'in-place') {
      await this.processInPlace(message, handler, retry);
      return;
    }

    let outcome: ConsumeOutcome;
    try {
      outcome = (await handler(message)) ?? done;
    } catch (error) {
      logger.error(`Failed to process a message from ${this.queueName}:`, error);
      outcome = this.decide(error, message);
    }

    await this.execute(outcome, message);
  }

  /**
   * Strictly ordered processing (the `in-place` policy): the message stays
   * unacknowledged and the handler is re-run for THE SAME message until it
   * succeeds — new messages keep piling up in the queue behind it (with
   * prefetch=1 the broker never delivers the next one while this one is
   * held). A failure is never turned into a nack: nothing is skipped,
   * reordered, parked or dropped. The pause between attempts grows
   * exponentially from `delayMs` up to `maxDelayMs`. The loop never gives
   * up: a permanently failing message blocks the queue on purpose until a
   * fix is deployed.
   */
  private async processInPlace(
    message: ConsumeMessage,
    handler: (message: ConsumeMessage) => Promise<ConsumeOutcome | void>,
    retry: Extract<RetryStrategy, { mode: 'in-place' }>,
  ): Promise<void> {
    let attempt = 0;
    let delayMs = retry.delayMs;
    const maxDelayMs = retry.maxDelayMs ?? Number.POSITIVE_INFINITY;

    for (;;) {
      let outcome: ConsumeOutcome;
      try {
        outcome = (await handler(message)) ?? done;
      } catch (error) {
        attempt += 1;
        const transient = this.policy.isTransient?.(error) ?? false;
        this.count(transient ? this.policy.metricNames?.transientRetried : this.policy.metricNames?.retried);
        logger.error(
          `${this.queueName}: attempt ${attempt} failed; holding the queue and retrying the same message in ${delayMs}ms`,
          error,
        );
        await delay(delayMs);
        delayMs = Math.min(delayMs * 2, maxDelayMs);
        continue;
      }

      if (outcome.kind === 'retry') {
        attempt += 1;
        this.count(this.policy.metricNames?.retried);
        logger.warn(
          `${this.queueName}: handler asked for a retry; holding the queue and retrying the same message in ${delayMs}ms`,
        );
        await delay(delayMs);
        delayMs = Math.min(delayMs * 2, maxDelayMs);
        continue;
      }

      await this.execute(outcome, message);
      return;
    }
  }

  /** Maps a thrown error to an outcome according to the policy. */
  private decide(error: unknown, message: ConsumeMessage): ConsumeOutcome {
    const { retry, isTransient, isPermanent } = this.policy;
    const reason = error instanceof Error ? error.message : String(error);

    if (isPermanent?.(error)) {
      return this.exhaustedOutcome(reason);
    }

    if (isTransient?.(error)) {
      return { kind: 'retry', transient: true };
    }

    if (retry.mode === 'dlx') {
      const retries = getRetryCount(message, retry.retryQueue);
      if (retries >= retry.maxAttempts) {
        return this.exhaustedOutcome(`Failed after ${retries} retries: ${String(error)}`);
      }
      return { kind: 'retry' };
    }

    if (retry.mode === 'buckets') {
      // Bucket retries are requested explicitly by the handler; a throw here is
      // unexpected, so the message goes straight to the exhausted action.
      return this.exhaustedOutcome(reason);
    }

    // immediate-once: execute() treats a failure on an already-redelivered
    // message as exhausted.
    return { kind: 'retry' };
  }

  private exhaustedOutcome(reason: string): ConsumeOutcome {
    return this.policy.exhausted === 'drop' ? { kind: 'drop', reason } : { kind: 'park', reason };
  }

  private async execute(outcome: ConsumeOutcome, message: ConsumeMessage): Promise<void> {
    switch (outcome.kind) {
      case 'done':
        await this.rabbitClient.ack(message);
        return;

      case 'drop':
        logger.warn(`Dropping a message from ${this.queueName}: ${outcome.reason}`);
        this.count(this.policy.metricNames?.dropped);
        await this.rabbitClient.ack(message);
        return;

      case 'park':
        await this.park(message, outcome.reason);
        return;

      case 'retry':
        await this.executeRetry(outcome, message);
        return;
    }
  }

  private async executeRetry(outcome: { kind: 'retry'; transient?: boolean }, message: ConsumeMessage): Promise<void> {
    const retry = this.policy.retry;
    if (retry.mode === 'in-place') {
      // Unreachable by construction: processInPlace() loops on retry outcomes
      // itself and execute() only ever receives final outcomes (done/park/drop).
      // Safety net: keep the message unacknowledged rather than ack a failed event.
      logger.error(`Unexpected in-place retry outcome on ${this.queueName}; leaving the message unacknowledged`);
      return;
    }

    switch (retry.mode) {
      case 'dlx':
        // The broker dead-letters the message into the retry queue; it returns
        // to this queue after the queue's TTL.
        if (outcome.transient) {
          logger.warn(`Transient failure on ${this.queueName}; retrying through the retry queue`);
          this.count(this.policy.metricNames?.transientRetried);
        } else {
          this.count(this.policy.metricNames?.retried);
        }
        await this.rabbitClient.nack(message, false);
        return;

      case 'buckets': {
        const attemptField = retry.attemptField ?? 'attempt';
        const attempt = getMessageAttempt(message, attemptField);
        const step = retry.steps[Math.min(attempt, retry.steps.length - 1)];

        let content: Record<string, any> | null = null;
        try {
          const parsed = JSON.parse(message.content.toString());
          if (parsed && typeof parsed === 'object') content = parsed;
        } catch {
          content = null;
        }

        if (!content) {
          await this.park(message, 'Cannot schedule a retry: the message body is not a JSON object');
          return;
        }

        try {
          await this.rabbitClient.sendToQueue(
            step.queue,
            { ...content, [attemptField]: attempt + 1 },
            { persistent: true },
          );
        } catch (error) {
          // Never lose the message when the retry cannot be scheduled.
          logger.error(`Failed to schedule a retry for ${this.queueName}; requeueing instead:`, error);
          await this.rabbitClient.nack(message, true);
          return;
        }

        this.count(this.policy.metricNames?.retried);
        await this.rabbitClient.ack(message);
        return;
      }

      case 'immediate-once':
        if (message.fields?.redelivered) {
          await this.execute(this.exhaustedOutcome('Failed on an already-redelivered message'), message);
          return;
        }
        this.count(this.policy.metricNames?.retried);
        await this.rabbitClient.nack(message, true);
        return;
    }
  }

  private async park(message: ConsumeMessage, reason: string): Promise<void> {
    const park = this.policy.park;

    if (!park || park.mode === 'dlx') {
      this.count(this.policy.metricNames?.parked);
      await this.rabbitClient.nack(message, false);
      return;
    }

    let content: unknown;
    const raw = message.content.toString();
    try {
      content = JSON.parse(raw);
    } catch {
      content = raw;
    }

    try {
      await this.rabbitClient.sendToQueue(park.queue, {
        reason,
        parkedAt: Date.now(),
        content,
      });
    } catch (error) {
      // Never leave the message unacknowledged: with prefetch=1 that would
      // stall the whole queue. Requeue it - the retry loop will park it again.
      logger.error(`Failed to park a message from ${this.queueName}; requeueing instead:`, error);
      await this.rabbitClient.nack(message, true);
      return;
    }

    await this.rabbitClient.ack(message);
    logger.error(`Parked a message from ${this.queueName}: ${reason}`);
    this.count(this.policy.metricNames?.parked);
  }

  private count(name?: string): void {
    if (name) {
      metrics.counter(name, { queue: this.queueName });
    }
  }
}
