import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { ReliableConsumer, done, type ConsumeOutcome } from '@shared/rabbitmq/src/reliableConsumer';
import { isTransientDbError, setupDlxRetryTopology } from '@shared/rabbitmq/src/reliability';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { metrics } from '@shared/monitoring/src/metrics';
import { processEventExactlyOnce } from './eventProcessing';
import type { ConsumeMessage } from 'amqplib';

export interface BlockchainEvent {
  chainId: number;
  name: string;
  blockNumber: number;
  transactionHash: string;
  address: string;
  logIndex: number;
  data: Record<string, any>;
  timestamp: number;
}

export type EventHandler = (event: BlockchainEvent) => Promise<void>;

export interface EventRouting {
  [eventName: string]: EventHandler;
}

const EXCHANGE_NAME = 'blockchain.events';
// TTL of the `<queue>.retry` queue. The queue stays declared for broker-state
// compatibility, but in-place processing never dead-letters a failed event.
const RETRY_DELAY_MS = 10_000;
// Blocking in-place retries: the pause after a failed attempt, doubling up to the cap.
const RETRY_INITIAL_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 30_000;

/** Overridable timing of the blocking in-place retries (tests use tiny values). */
export interface BlockchainDaemonRetryOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Base daemon for handling blockchain events.
 *
 * Strict ordering: blockchain events rebuild the backend state incrementally,
 * so they must be applied in chain order. A failed event is retried IN PLACE —
 * the message stays unacknowledged and the handler is re-run for the same
 * message (exponential backoff from RETRY_INITIAL_DELAY_MS up to
 * RETRY_MAX_DELAY_MS) until it succeeds; new events keep accumulating in the
 * queue behind it (prefetch=1: the broker never delivers the next message
 * while this one is held). Nothing is nacked, skipped or moved aside for a
 * processing failure: a permanently failing event blocks the queue on purpose
 * until a fix is deployed. The only non-blocking exception is a payload that
 * is not a JSON event (parked — it can never become processable).
 *
 * Events are processed exactly once: a unique processed-events marker and all
 * handler writes are committed in a single MongoDB transaction (see
 * `processEventExactlyOnce`). Duplicate deliveries are filtered out and every
 * failure rolls back completely, so a retry always starts from a clean slate.
 */
export abstract class BaseBlockchainDaemon {
  private isRunning: boolean = false;
  private processingPromise: Promise<void> = Promise.resolve();

  private readonly reliableConsumer: ReliableConsumer;

  constructor(
    protected readonly rabbitClient: RabbitMQClient,
    private readonly queueName: string,
    retryOptions: BlockchainDaemonRetryOptions = {},
  ) {
    this.reliableConsumer = new ReliableConsumer(rabbitClient, queueName, {
      // Strict ordering: a failed event is retried in place (the same message,
      // still unacknowledged) until it succeeds; the queue holds everything
      // behind it. Never exhausted, never parked for processing failures.
      retry: {
        mode: 'in-place',
        delayMs: retryOptions.initialDelayMs ?? RETRY_INITIAL_DELAY_MS,
        maxDelayMs: retryOptions.maxDelayMs ?? RETRY_MAX_DELAY_MS,
      },
      exhausted: 'park',
      park: { mode: 'envelope', queue: `${queueName}.parked` },
      isTransient: isTransientDbError,
      metricNames: {
        retried: 'blockchain_event_retries_total',
        transientRetried: 'blockchain_event_transient_retries_total',
        parked: 'blockchain_events_parked_total',
      },
    });
  }

  /**
   * Define event routing - which events to handle and how
   * Must be implemented by child classes
   */
  protected abstract getEventRouting(): EventRouting;

  /**
   * Initialize daemon and setup queues
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Blockchain Events Daemon');

      const routing = this.getEventRouting();

      // Setup direct exchange
      await this.rabbitClient.setupExchange(EXCHANGE_NAME, 'direct', {
        durable: true,
      });

      // Create the queue with its parked queue; the `<queue>.retry` topology
      // stays declared for broker-state compatibility (existing queues already
      // carry its arguments) but in-place processing never dead-letters.
      await setupDlxRetryTopology(this.rabbitClient, this.queueName, RETRY_DELAY_MS);

      // Bind queue to each event we want to handle
      for (const eventName of Object.keys(routing)) {
        await this.rabbitClient.bindQueue(this.queueName, EXCHANGE_NAME, eventName);
        logger.info(`Bound queue ${this.queueName} to event ${eventName}`);
      }

      // Start consuming messages
      await this.startConsuming();

      logger.info('Blockchain Events Daemon initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Blockchain Events Daemon:', error);
      throw error;
    }
  }

  /**
   * Start consuming messages
   */
  private async startConsuming(): Promise<void> {
    // Events are processed strictly one at a time (prefetch=1): the next message
    // is not even delivered while the current one is being retried in place.
    await this.reliableConsumer.consume((message) => this.handleMessage(message), { prefetch: 1 });
  }

  /**
   * Handle incoming message: serializes processing and hands it to the shared
   * reliability contract (ack on success; a failure holds the queue and retries
   * the same message in place until it succeeds).
   */
  private async handleMessage(message: ConsumeMessage): Promise<ConsumeOutcome | void> {
    const processing = this.processingPromise.then(() => this.processMessage(message));
    this.processingPromise = processing.then(
      () => undefined,
      (error) => {
        // Handled by the reliability contract; kept for tracing only.
        logger.debug('Blockchain event processing failed', error);
      },
    );
    return processing;
  }

  private async processMessage(message: ConsumeMessage): Promise<ConsumeOutcome | void> {
    let event: BlockchainEvent;
    try {
      event = JSON.parse(message.content.toString()) as BlockchainEvent;
    } catch (error) {
      logger.error('Failed to parse blockchain event payload; parking the message:', error);
      return { kind: 'park', reason: 'Invalid payload (not a JSON event)' };
    }

    const handler = this.getEventRouting()[event.name];
    if (!handler) {
      logger.warn(`No handler registered for event ${event.name}`);
      return done;
    }

    try {
      // Exactly-once: the processed-events marker and every handler write
      // commit atomically; duplicates roll back and are acknowledged.
      const applied = await processEventExactlyOnce(event, () => handler(event));

      if (!applied) {
        metrics.counter('blockchain_events_duplicates_total', { queue: this.queueName });
        logger.debug(`Skipped duplicate blockchain event ${event.name}`, {
          transactionHash: event.transactionHash,
          logIndex: event.logIndex,
        });
      } else {
        logger.debug(`Successfully processed blockchain event ${event.name}`, {
          transactionHash: event.transactionHash,
        });
      }

      return done;
    } catch (error) {
      logger.error(`Error processing blockchain event ${event.name}:`, error);
      throw error; // the in-place retry loop retries this same message
    }
  }

  /**
   * Start daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Blockchain Events Daemon is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Blockchain Events Daemon');
  }

  /**
   * Stop daemon
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Blockchain Events Daemon is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping Blockchain Events Daemon');
  }
}
