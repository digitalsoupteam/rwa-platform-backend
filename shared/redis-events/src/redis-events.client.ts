import Redis from 'ioredis';
import { logger } from '@shared/monitoring/src/logger';

export interface EventMetadata {
  timestamp: number;
  service: string;
  version: string;
}

export interface Event<T = unknown> {
  type: string;
  payload: T;
  metadata: EventMetadata;
}

export class RedisEventsClient {
  private publisher: Redis;
  private subscriber: Redis;
  private serviceName: string;
  private version: string;

  constructor(redisUrl: string, serviceName: string, version = '1.0.0') {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    this.serviceName = serviceName;
    this.version = version;

    
    this.publisher.on('error', (err) => {
      logger.error('Redis publisher error:', err);
    });

    this.subscriber.on('error', (err) => {
      logger.error('Redis subscriber error:', err);
    });
  }

  
  async publish<T>(channel: string, type: string, payload: T): Promise<void> {
    const event: Event<T> = {
      type,
      payload,
      metadata: {
        timestamp: Date.now(),
        service: this.serviceName,
        version: this.version
      }
    };

    try {
      await this.publisher.publish(channel, JSON.stringify(event));
      logger.debug('Event published', { channel, type });
    } catch (error) {
      logger.error('Failed to publish event:', error);
      throw error;
    }
  }

  
  subscribe(channel: string, callback: (event: Event) => void): () => void {
    this.subscriber.subscribe(channel, (err) => {
      if (err) {
        logger.error('Failed to subscribe:', err);
        throw err;
      }
      logger.debug('Subscribed to channel:', channel);
    });

    const messageHandler = (_channel: string, message: string) => {
      try {
        const event: Event = JSON.parse(message);
        callback(event);
      } catch (error) {
        logger.error('Failed to handle message:', error);
      }
    };

    this.subscriber.on('message', messageHandler);

    
    return () => {
      this.subscriber.unsubscribe(channel);
      this.subscriber.off('message', messageHandler);
    };
  }

  
  async close(): Promise<void> {
    await Promise.all([
      this.publisher.quit(),
      this.subscriber.quit()
    ]);
  }
}