import { MessageBroker, MessageBrokerConfig, Message } from './message-broker';
import { logger } from '../utils/structured-logger';
import { metrics } from '../utils/monitoring';

export interface PubSubConfig extends MessageBrokerConfig {
  exchangeName: string; // Обязательное поле для PubSub
  exchangeType?: 'fanout' | 'topic' | 'direct';
}

export interface Event<T = any> {
  type: string;
  data: T;
  timestamp?: number;
  source?: string;
}

export class PubSub extends MessageBroker {
  private subscriptions: Map<string, string[]> = new Map();

  constructor(config: PubSubConfig) {
    super({
      ...config,
      exchangeType: config.exchangeType || 'topic',
    });
  }

  async initialize(): Promise<void> {
    await this.connect();

    if (!this.channel) throw new Error('Channel not initialized');

    // Создаем exchange для событий
    await this.channel.assertExchange(
      this.config.exchangeName!,
      this.config.exchangeType!,
      {
        durable: true,
      }
    );

    logger.info('PubSub initialized', {
      exchange: this.config.exchangeName,
      type: this.config.exchangeType,
    });
  }

  async publish<T>(
    event: Event<T>,
    routingKey: string = '#'
  ): Promise<boolean> {
    if (!this.channel) throw new Error('Channel not initialized');

    const message: Message<Event<T>> = {
      data: {
        ...event,
        timestamp: event.timestamp || Date.now(),
        source: process.env.SERVICE_NAME,
      },
      headers: {
        messageId: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        eventType: event.type,
      },
    };

    try {
      const result = await this.publishWithRetry(
        this.config.exchangeName!,
        routingKey,
        message
      );

      if (result) {
        metrics.increment('events_published', {
          exchange: this.config.exchangeName!,
          type: event.type,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to publish event', {
        error,
        eventType: event.type,
        exchange: this.config.exchangeName,
      });
      throw error;
    }
  }

  async subscribe<T>(
    pattern: string,
    handler: (event: Event<T>) => Promise<void>,
    options: {
      queue?: string;
      exclusive?: boolean;
    } = {}
  ): Promise<string> {
    if (!this.channel) throw new Error('Channel not initialized');

    // Создаем уникальную очередь для подписчика если не указана
    const queueName = options.queue || 
      `${this.config.exchangeName}.${pattern}.${Math.random().toString(36).substring(7)}`;

    await this.channel.assertQueue(queueName, {
      exclusive: options.exclusive || !options.queue,
      durable: !!options.queue,
    });

    // Привязываем очередь к exchange с указанным паттерном
    await this.channel.bindQueue(queueName, this.config.exchangeName!, pattern);

    // Сохраняем привязку для возможности отписки
    const bindings = this.subscriptions.get(queueName) || [];
    bindings.push(pattern);
    this.subscriptions.set(queueName, bindings);

    this.setupConsumer(
      queueName,
      async (message: Message) => {
        const event = message.data as Event<T>;

        metrics.increment('events_received', {
          exchange: this.config.exchangeName!,
          type: event.type,
        });

        const startTime = Date.now();

        try {
          await handler(event);
          
          const processingTime = Date.now() - startTime;
          metrics.gauge('event_processing_time', processingTime, {
            exchange: this.config.exchangeName!,
            type: event.type,
          });
          
          metrics.increment('events_processed', {
            exchange: this.config.exchangeName!,
            type: event.type,
          });

          logger.debug('Event processed successfully', {
            eventType: event.type,
            processingTime,
            pattern,
          });
        } catch (error) {
          metrics.increment('events_failed', {
            exchange: this.config.exchangeName!,
            type: event.type,
          });
          
          logger.error('Event processing failed', {
            error,
            eventType: event.type,
            pattern,
          });
          throw error;
        }
      },
      {
        noAck: false,
      }
    );

    logger.info('Subscription created', {
      exchange: this.config.exchangeName,
      pattern,
      queue: queueName,
    });

    return queueName;
  }

  async unsubscribe(queueName: string): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    try {
      // Удаляем все привязки
      const bindings = this.subscriptions.get(queueName);
      if (bindings) {
        for (const pattern of bindings) {
          await this.channel.unbindQueue(
            queueName,
            this.config.exchangeName!,
            pattern
          );
        }
      }

      // Удаляем очередь
      await this.channel.deleteQueue(queueName);
      
      // Очищаем информацию о привязках
      this.subscriptions.delete(queueName);

      logger.info('Unsubscribed successfully', {
        exchange: this.config.exchangeName,
        queue: queueName,
      });
    } catch (error) {
      logger.error('Failed to unsubscribe', {
        error,
        exchange: this.config.exchangeName,
        queue: queueName,
      });
      throw error;
    }
  }

  async getExchangeBindings(): Promise<{ queue: string; patterns: string[] }[]> {
    return Array.from(this.subscriptions.entries()).map(([queue, patterns]) => ({
      queue,
      patterns,
    }));
  }
}
