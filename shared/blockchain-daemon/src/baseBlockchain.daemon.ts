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
const RETRY_DELAY_MS = 10_000;
const MAX_RETRIES = 3;

/**
 * Base daemon for handling blockchain events.
 *
 * Events are processed exactly once: a unique processed-events marker and all
 * handler writes are committed in a single MongoDB transaction (see
 * `processEventExactlyOnce`). Duplicate deliveries are filtered out and every
 * failure rolls back completely, so a retry always starts from a clean slate.
 * Failures ride the shared reliability contract (`ReliableConsumer`): the
 * broker redelivers messages through `<queue>.retry` after RETRY_DELAY_MS;
 * transient infrastructure errors keep cycling through it, real failures are
 * retried up to MAX_RETRIES times and then parked for manual inspection.
 */
export abstract class BaseBlockchainDaemon {
  private isRunning: boolean = false;
  private processingPromise: Promise<void> = Promise.resolve();

  private readonly reliableConsumer: ReliableConsumer;

  constructor(
    protected readonly rabbitClient: RabbitMQClient,
    private readonly queueName: string,
  ) {
    this.reliableConsumer = new ReliableConsumer(rabbitClient, queueName, {
      retry: { mode: 'dlx', retryQueue: `${queueName}.retry`, maxAttempts: MAX_RETRIES },
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

      // Create the queue with its retry topology (retry queue + parked queue)
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
    // Events are processed strictly one at a time; the chain never stays rejected.
    await this.reliableConsumer.consume((message) => this.handleMessage(message), { prefetch: 1 });
  }

  /**
   * Handle incoming message: serializes processing and hands the outcome to
   * the shared reliability contract (ack on success, retry/park on failure).
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
      throw error; // the reliability contract decides between retry and park
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
