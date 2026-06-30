import Redis from 'ioredis';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class RedisClient {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl);

    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  @TraceDecorator()
  async sadd(key: string, member: string): Promise<void> {
    await this.client.sadd(key, member);
  }

  @TraceDecorator()
  async srem(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  @TraceDecorator()
  async smembers(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }

  @TraceDecorator()
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  @TraceDecorator()
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  @TraceDecorator()
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  @TraceDecorator()
  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  @TraceDecorator()
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
