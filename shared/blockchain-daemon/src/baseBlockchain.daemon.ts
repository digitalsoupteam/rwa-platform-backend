import { RabbitMQClient } from "@shared/rabbitmq/src/rabbitmq.client";
import { logger } from "@shared/monitoring/src/logger";
import type { ConsumeMessage } from "amqplib";

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

/**
 * Base daemon for handling blockchain events
 */
export abstract class BaseBlockchainDaemon {
  private readonly EXCHANGE_NAME = "blockchain.events";
  private isRunning: boolean = false;

  constructor(
    protected readonly rabbitClient: RabbitMQClient,
    private readonly queueName: string
  ) {}

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
      logger.info("Initializing Blockchain Events Daemon");

      const channel = this.rabbitClient.getChannel();
      if (!channel) {
        throw new Error("RabbitMQ channel not initialized");
      }

      const routing = this.getEventRouting();

      // Setup direct exchange
      await this.rabbitClient.setupExchange(this.EXCHANGE_NAME, "direct", { 
        durable: true 
      });
      
      // Create queue
      await this.rabbitClient.setupQueue(this.queueName, { 
        durable: true 
      });
      
      // Bind queue to each event we want to handle
      for (const eventName of Object.keys(routing)) {
        await this.rabbitClient.bindQueue(
          this.queueName,
          this.EXCHANGE_NAME,
          eventName
        );
        logger.info(`Bound queue ${this.queueName} to event ${eventName}`);
      }

      // Start consuming messages
      await this.startConsuming();

      logger.info("Blockchain Events Daemon initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Blockchain Events Daemon:", error);
      throw error;
    }
  }

  /**
   * Start consuming messages
   */
  private async startConsuming(): Promise<void> {
    await this.rabbitClient.consume(
      this.queueName,
      this.handleMessage.bind(this),
      { noAck: false }
    );
  }

  /**
   * Handle incoming message
   */
  private processingPromise: Promise<void> = Promise.resolve();

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message) return;

    this.processingPromise = this.processingPromise.then(async () => {
      const event = JSON.parse(message.content.toString()) as BlockchainEvent;
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
          transactionHash: event.transactionHash
        });
      } catch (error) {
        logger.error(`Error processing blockchain event ${event.name}:`, error);
        // Reject message and requeue
        await this.rabbitClient.nack(message, false);
      }
    });

    await this.processingPromise;
  }

  /**
   * Start daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Blockchain Events Daemon is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting Blockchain Events Daemon");
  }

  /**
   * Stop daemon
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("Blockchain Events Daemon is not running");
      return;
    }

    this.isRunning = false;
    logger.info("Stopping Blockchain Events Daemon");
  }
}