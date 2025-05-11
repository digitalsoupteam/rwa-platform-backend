import { Channel, connect, ConsumeMessage, ChannelModel } from "amqplib";
import { logger } from "@shared/monitoring/src/logger";

export interface RabbitMQConfig {
  uri: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export class RabbitMQClient {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isShuttingDown: boolean = false;
  private reconnectAttempts: number = 0;

  constructor(private config: RabbitMQConfig) {
    this.config.reconnectAttempts = this.config.reconnectAttempts || 5;
    this.config.reconnectInterval = this.config.reconnectInterval || 5000;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await connect(this.config.uri);
      this.channel = await this.connection.createChannel();

      this.connection.on('error', this.handleConnectionError.bind(this));
      this.connection.on('close', this.handleConnectionClose.bind(this));

      this.reconnectAttempts = 0;
      logger.info('Connected to RabbitMQ');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isShuttingDown = true;

    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  getChannel(): Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    return this.channel;
  }

  async setupQueue(queue: string, options?: any): Promise<void> {
    const channel = this.getChannel();
    await channel.assertQueue(queue, options);
  }

  async setupExchange(exchange: string, type: string, options?: any): Promise<void> {
    const channel = this.getChannel();
    await channel.assertExchange(exchange, type, options);
  }

  async bindQueue(queue: string, exchange: string, pattern: string): Promise<void> {
    const channel = this.getChannel();
    await channel.bindQueue(queue, exchange, pattern);
  }

  async publish(exchange: string, routingKey: string, content: any, options?: any): Promise<void> {
    const channel = this.getChannel();
    const buffer = Buffer.from(JSON.stringify(content));
    channel.publish(exchange, routingKey, buffer, {
      persistent: true,
      contentType: 'application/json',
      ...options
    });
  }

  async sendToQueue(queue: string, content: any, options?: any): Promise<void> {
    const channel = this.getChannel();
    const buffer = Buffer.from(JSON.stringify(content));
    channel.sendToQueue(queue, buffer, {
      persistent: true,
      contentType: 'application/json',
      ...options
    });
  }

  async consume(queue: string, handler: (msg: ConsumeMessage | null) => Promise<void>, options?: any): Promise<void> {
    const channel = this.getChannel();
    await channel.consume(queue, handler, options);
  }

  async ack(message: ConsumeMessage): Promise<void> {
    const channel = this.getChannel();
    channel.ack(message);
  }

  async nack(message: ConsumeMessage, requeue: boolean = true): Promise<void> {
    const channel = this.getChannel();
    channel.nack(message, false, requeue);
  }

  private handleConnectionError(error: any): void {
    if (this.isShuttingDown) return;
    logger.error('RabbitMQ connection error:', error);
    this.reconnect();
  }

  private handleConnectionClose(): void {
    if (this.isShuttingDown) return;
    logger.warn('RabbitMQ connection closed unexpectedly');
    this.reconnect();
  }

  private async reconnect(): Promise<void> {
    if (this.isShuttingDown) return;

    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.config.reconnectAttempts!) {
      logger.error(`Failed to reconnect to RabbitMQ after ${this.reconnectAttempts} attempts`);
      return;
    }

    logger.info(`Attempting to reconnect to RabbitMQ (${this.reconnectAttempts}/${this.config.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Failed to reconnect to RabbitMQ:', error);
      }
    }, this.config.reconnectInterval);
  }
}