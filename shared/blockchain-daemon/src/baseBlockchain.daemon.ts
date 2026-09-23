import { RabbitMQClient } from '@shared/rabbitmq/src/rabbitmq.client';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { metrics } from '@shared/monitoring/src/metrics';
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
 * Failed events are no longer dropped: the queue dead-letters them to a retry
 * queue that holds each message for RETRY_DELAY_MS and then routes it back.
 * After MAX_RETRIES failed attempts the event is parked for manual inspection.
 */
export abstract class BaseBlockchainDaemon {
  private isRunning: boolean = false;
  private processingPromise: Promise<void> = Promise.resolve();

  private readonly retryExchangeName: string;
  private readonly retryQueueName: string;
  private readonly retryRoutingKey: string;
  private readonly parkedQueueName: string;

  constructor(
    protected readonly rabbitClient: RabbitMQClient,
    private readonly queueName: string,
  ) {
    this.retryExchangeName = `${queueName}.retry.exchange`;
    this.retryQueueName = `${queueName}.retry`;
    this.retryRoutingKey = `${queueName}.retry`;
    this.parkedQueueName = `${queueName}.parked`;
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

      // Setup retry exchange
      await this.rabbitClient.setupExchange(this.retryExchangeName, 'direct', {
        durable: true,
      });

      // Create queue; failed deliveries are dead-lettered to the retry queue
      await this.rabbitClient.setupQueue(this.queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': this.retryExchangeName,
          'x-dead-letter-routing-key': this.retryRoutingKey,
        },
      });

      // Retry queue: holds failed messages for RETRY_DELAY_MS and then
      // dead-letters them back to the main queue through the default exchange
      await this.rabbitClient.setupQueue(this.retryQueueName, {
        durable: true,
        arguments: {
          'x-message-ttl': RETRY_DELAY_MS,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': this.queueName,
        },
      });

      // Events that exhausted all retries are parked here for manual inspection
      await this.rabbitClient.setupQueue(this.parkedQueueName, {
        durable: true,
      });

      // Bind queue to each event we want to handle
      for (const eventName of Object.keys(routing)) {
        await this.rabbitClient.bindQueue(this.queueName, EXCHANGE_NAME, eventName);
        logger.info(`Bound queue ${this.queueName} to event ${eventName}`);
      }

      await this.rabbitClient.bindQueue(this.retryQueueName, this.retryExchangeName, this.retryRoutingKey);

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
    await this.rabbitClient.consume(this.queueName, this.handleMessage.bind(this), {
      noAck: false,
      prefetch: 1,
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message) return;

    // Events are processed strictly one at a time; the chain never stays rejected.
    this.processingPromise = this.processingPromise
      .then(() => this.processMessage(message))
      .catch((error) => {
        logger.error('Unexpected error while handling blockchain event', error);
      });

    await this.processingPromise;
  }

  private async processMessage(message: ConsumeMessage): Promise<void> {
    let event: BlockchainEvent;
    try {
      event = JSON.parse(message.content.toString()) as BlockchainEvent;
    } catch (error) {
      logger.error('Failed to parse blockchain event payload; parking the message:', error);
      await this.parkMessage(message, 'Invalid payload (not a JSON event)');
      return;
    }

    try {
      const routing = this.getEventRouting();

      // Get handler for this event
      const handler = routing[event.name];
      if (!handler) {
        logger.warn(`No handler registered for event ${event.name}`);
        await this.rabbitClient.ack(message);
        return;
      }

      // Process event
      await handler(event);

      // Acknowledge message
      await this.rabbitClient.ack(message);

      logger.debug(`Successfully processed blockchain event ${event.name}`, {
        transactionHash: event.transactionHash,
      });
    } catch (error) {
      logger.error(`Error processing blockchain event ${event.name}:`, error);
      await this.retryOrPark(message, error);
    }
  }

  /**
   * Failed event: retry with a delay or park it after too many failures
   */
  private async retryOrPark(message: ConsumeMessage, error: unknown): Promise<void> {
    const retries = this.getRetryCount(message);

    if (retries >= MAX_RETRIES) {
      logger.error(`Blockchain event failed after ${retries} retries; parking it`);
      await this.parkMessage(message, `Failed after ${retries} retries: ${String(error)}`);
      return;
    }

    // Dead-letters the message to the retry queue; it returns after RETRY_DELAY_MS
    await this.rabbitClient.nack(message, false);
    metrics.counter('blockchain_event_retries_total', { queue: this.queueName });
  }

  /**
   * How many times this message has already passed through the retry queue
   */
  private getRetryCount(message: ConsumeMessage): number {
    const xDeath = (message.properties.headers?.['x-death'] ?? []) as Array<{ queue?: string; count?: number }>;
    const retryEntry = xDeath.find((entry) => entry.queue === this.retryQueueName);
    return retryEntry?.count ? Number(retryEntry.count) : 0;
  }

  /**
   * Publish the raw event to the parked queue and acknowledge the original message
   */
  private async parkMessage(message: ConsumeMessage, reason: string): Promise<void> {
    let content: unknown;
    const raw = message.content.toString();
    try {
      content = JSON.parse(raw);
    } catch {
      content = raw;
    }

    await this.rabbitClient.sendToQueue(this.parkedQueueName, {
      reason,
      parkedAt: Date.now(),
      content,
    });
    await this.rabbitClient.ack(message);
    metrics.counter('blockchain_events_parked_total', { queue: this.queueName });
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
