import amqp, { Connection, Channel, Options, ConsumeMessage } from 'amqplib';
import { logger } from '../utils/structured-logger';
import { metrics } from '../utils/monitoring';

export interface MessageBrokerConfig {
  url: string;
  exchangeName?: string;
  exchangeType?: string;
  queueName?: string;
  deadLetterExchange?: string;
  retryDelay?: number;
  maxRetries?: number;
}

export interface MessageHeaders {
  retryCount?: number;
  timestamp?: number;
  messageId?: string;
  correlationId?: string;
  [key: string]: any;
}

export interface Message<T = any> {
  data: T;
  headers?: MessageHeaders;
}

export class MessageBroker {
  protected connection?: Connection;
  protected channel?: Channel;
  protected readonly config: MessageBrokerConfig;
  private readonly retryDelayMs: number;
  private readonly maxRetries: number;

  constructor(config: MessageBrokerConfig) {
    this.config = config;
    this.retryDelayMs = config.retryDelay || 5000;
    this.maxRetries = config.maxRetries || 3;

    // Инициализация метрик
    metrics.gauge('rabbitmq_connection_status', 0);
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.config.url);
      this.channel = await this.connection.createChannel();
      
      // Настройка обработки ошибок и переподключения
      this.connection.on('error', this.handleConnectionError.bind(this));
      this.connection.on('close', this.handleConnectionClose.bind(this));
      
      // Настройка DLX если указан
      if (this.config.deadLetterExchange) {
        await this.setupDeadLetterExchange();
      }

      // Настройка основного exchange если указан
      if (this.config.exchangeName && this.config.exchangeType) {
        await this.channel.assertExchange(
          this.config.exchangeName,
          this.config.exchangeType,
          { durable: true }
        );
      }

      metrics.gauge('rabbitmq_connection_status', 1);
      logger.info('Successfully connected to RabbitMQ');
    } catch (error) {
      metrics.gauge('rabbitmq_connection_status', 0);
      logger.error('Failed to connect to RabbitMQ', { error });
      throw error;
    }
  }

  protected async setupDeadLetterExchange(): Promise<void> {
    if (!this.channel || !this.config.deadLetterExchange) return;

    await this.channel.assertExchange(this.config.deadLetterExchange, 'direct', {
      durable: true
    });

    // DLQ для сообщений, превысивших лимит попыток
    const dlq = `${this.config.deadLetterExchange}.dlq`;
    await this.channel.assertQueue(dlq, {
      durable: true,
      arguments: {
        'x-message-ttl': 1000 * 60 * 60 * 24, // 24 часа TTL для DLQ
      }
    });

    await this.channel.bindQueue(dlq, this.config.deadLetterExchange, '#');
  }

  protected async publishWithRetry(
    exchange: string,
    routingKey: string,
    message: Message,
    options: Options.Publish = {}
  ): Promise<boolean> {
    if (!this.channel) throw new Error('Channel not initialized');

    const headers = {
      ...message.headers,
      timestamp: Date.now(),
      messageId: message.headers?.messageId || Math.random().toString(36).substring(7),
    };

    try {
      const result = await this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message.data)),
        {
          persistent: true,
          headers,
          ...options,
        }
      );

      if (result) {
        metrics.increment('rabbitmq_messages_published');
        logger.debug('Message published successfully', {
          exchange,
          routingKey,
          messageId: headers.messageId,
        });
      }

      return result;
    } catch (error) {
      metrics.increment('rabbitmq_messages_failed');
      logger.error('Failed to publish message', { error });
      throw error;
    }
  }

  protected setupConsumer(
    queueName: string,
    handler: (msg: Message) => Promise<void>,
    options: Options.Consume = {}
  ): void {
    if (!this.channel) throw new Error('Channel not initialized');

    this.channel.consume(
      queueName,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        try {
          const message: Message = {
            data: JSON.parse(msg.content.toString()),
            headers: msg.properties.headers,
          };

          const retryCount = (message.headers?.retryCount || 0) as number;

          try {
            await handler(message);
            this.channel?.ack(msg);
            metrics.increment('rabbitmq_messages_consumed');
          } catch (error) {
            metrics.increment('rabbitmq_messages_failed');
            
            if (retryCount < this.maxRetries) {
              // Переотправка с увеличенной задержкой
              const delay = this.retryDelayMs * Math.pow(2, retryCount);
              await this.retryMessage(msg, delay, retryCount + 1);
              this.channel?.ack(msg);
            } else {
              // Отправка в DLQ если превышен лимит попыток
              await this.sendToDLQ(msg);
              this.channel?.ack(msg);
            }
          }
        } catch (error) {
          logger.error('Error processing message', { error });
          this.channel?.nack(msg, false, false);
        }
      },
      options
    );
  }

  private async retryMessage(
    msg: ConsumeMessage,
    delay: number,
    retryCount: number
  ): Promise<void> {
    if (!this.channel || !this.config.queueName) return;

    const retryQueue = `${this.config.queueName}.retry.${delay}`;
    
    await this.channel.assertQueue(retryQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': this.config.queueName,
        'x-message-ttl': delay,
      },
    });

    const headers = { ...msg.properties.headers, retryCount };
    
    await this.channel.publish(
      '',
      retryQueue,
      msg.content,
      {
        persistent: true,
        headers,
      }
    );

    metrics.increment('rabbitmq_retries');
    logger.debug('Message scheduled for retry', {
      queue: this.config.queueName,
      retryCount,
      delay,
    });
  }

  private async sendToDLQ(msg: ConsumeMessage): Promise<void> {
    if (!this.channel || !this.config.deadLetterExchange) return;

    await this.channel.publish(
      this.config.deadLetterExchange,
      '#',
      msg.content,
      {
        persistent: true,
        headers: msg.properties.headers,
      }
    );

    logger.info('Message sent to DLQ', {
      exchange: this.config.deadLetterExchange,
      headers: msg.properties.headers,
    });
  }

  private handleConnectionError(error: Error): void {
    metrics.gauge('rabbitmq_connection_status', 0);
    logger.error('RabbitMQ connection error', { error });
  }

  private handleConnectionClose(): void {
    metrics.gauge('rabbitmq_connection_status', 0);
    logger.info('RabbitMQ connection closed, attempting to reconnect...');
    setTimeout(() => this.connect(), 5000);
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      metrics.gauge('rabbitmq_connection_status', 0);
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection', { error });
      throw error;
    }
  }
}
