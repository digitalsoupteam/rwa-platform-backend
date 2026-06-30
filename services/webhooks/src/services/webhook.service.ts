import crypto from 'crypto';
import { AppError } from '@shared/errors/app-errors';
import { EndpointRepository } from '../repositories/endpoint.repository';
import { RedisClient } from '../clients/redis.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';
import { metrics } from '@shared/monitoring/src/metrics';

const MAX_ENDPOINTS_PER_USER = 50;

export class WebhookService {
  private encryptionKey: Buffer;

  constructor(
    private readonly endpointRepository: EndpointRepository,
    private readonly redisClient: RedisClient,
    encryptionKeyBase64: string,
  ) {
    this.encryptionKey = Buffer.from(encryptionKeyBase64, 'base64');
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ userId: a[0].userId, url: a[0].url }),
  })
  async createEndpoint(data: {
    userId: string;
    wallet: string;
    url: string;
    events: string[];
    description?: string;
    rateLimitPerMinute?: number;
  }) {
    setSpanAttributes({ userId: data.userId });

    this.validateUrl(data.url);

    const count = await this.endpointRepository.countByUser(data.userId);
    if (count >= MAX_ENDPOINTS_PER_USER) {
      throw new AppError({
        message: `Maximum ${MAX_ENDPOINTS_PER_USER} webhook endpoints per user`,
        statusCode: 400,
        code: 'LIMIT_EXCEEDED',
      });
    }

    const rawSecret = crypto.randomUUID() + crypto.randomBytes(16).toString('hex');
    const encryptedSecret = this.encryptSecret(rawSecret);

    const doc = await this.endpointRepository.createEndpoint({
      userId: data.userId,
      wallet: data.wallet,
      url: data.url,
      secret: encryptedSecret,
      events: data.events,
      description: data.description || '',
      rateLimitPerMinute: data.rateLimitPerMinute || 100,
    });

    await this.syncCacheOnCreate(doc._id.toString(), data.events);

    metrics.counter('webhook_endpoints_created_total');

    return {
      id: doc._id.toString(),
      userId: doc.userId,
      wallet: doc.wallet,
      url: doc.url,
      events: doc.events,
      description: doc.description,
      active: doc.active,
      rateLimitPerMinute: doc.rateLimitPerMinute,
      secret: rawSecret,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ userId: a[0].userId }),
  })
  async getEndpoints(data: { userId: string; wallet: string }) {
    setSpanAttributes({ userId: data.userId });
    const docs = await this.endpointRepository.findAll({ userId: data.userId });
    return docs.map((doc) => ({
      id: doc._id.toString(),
      userId: doc.userId,
      wallet: doc.wallet,
      url: doc.url,
      events: doc.events,
      description: doc.description,
      active: doc.active,
      rateLimitPerMinute: doc.rateLimitPerMinute,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, userId: a[0].userId }),
  })
  async getEndpoint(data: { id: string; userId: string; wallet: string }) {
    setSpanAttributes({ endpointId: data.id, userId: data.userId });
    const doc = await this.endpointRepository.findById(data.id);
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      wallet: doc.wallet,
      url: doc.url,
      events: doc.events,
      description: doc.description,
      active: doc.active,
      rateLimitPerMinute: doc.rateLimitPerMinute,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, userId: a[0].userId }),
  })
  async updateEndpoint(data: {
    id: string;
    userId: string;
    wallet: string;
    url?: string;
    events?: string[];
    description?: string;
    active?: boolean;
    rateLimitPerMinute?: number;
  }) {
    setSpanAttributes({ endpointId: data.id, userId: data.userId });

    const existing = await this.endpointRepository.findById(data.id);

    if (data.url) {
      this.validateUrl(data.url);
    }

    let newSecret: string | undefined;
    if (data.url && data.url !== existing.url) {
      const rawNewSecret = crypto.randomUUID() + crypto.randomBytes(16).toString('hex');
      newSecret = rawNewSecret;
    }

    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.userId;
    delete updateData.wallet;
    if (newSecret) {
      updateData.secret = this.encryptSecret(newSecret);
    }

    const doc = await this.endpointRepository.updateEndpoint(data.id, updateData);

    if (data.events) {
      const oldEvents = existing.events;
      const added = data.events.filter((e) => !oldEvents.includes(e));
      const removed = oldEvents.filter((e) => !data.events!.includes(e));
      await this.syncCacheOnUpdate(doc._id.toString(), added, removed);
    }

    if (data.active !== undefined) {
      if (!data.active) {
        await this.redisClient.set(`webhook:endpoint:${doc._id.toString()}:active`, '0', 3600);
      } else {
        await this.redisClient.del(`webhook:endpoint:${doc._id.toString()}:active`);
      }
    }

    return {
      id: doc._id.toString(),
      userId: doc.userId,
      wallet: doc.wallet,
      url: doc.url,
      events: doc.events,
      description: doc.description,
      active: doc.active,
      rateLimitPerMinute: doc.rateLimitPerMinute,
      secret: newSecret,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, userId: a[0].userId }),
  })
  async deleteEndpoint(data: { id: string; userId: string; wallet: string }) {
    setSpanAttributes({ endpointId: data.id, userId: data.userId });

    const doc = await this.endpointRepository.deleteEndpoint(data.id);

    for (const event of doc.events) {
      await this.redisClient.srem(`webhook:events:${event}`, doc._id.toString());
    }
    await this.redisClient.del(`webhook:endpoint:${doc._id.toString()}:active`);

    return { id: data.id };
  }

  @TraceDecorator()
  async findEndpointsByEvent(eventType: string) {
    try {
      const isConnected = await this.redisClient.isConnected();
      if (isConnected) {
        const endpointIds = await this.redisClient.smembers(`webhook:events:${eventType}`);
        if (endpointIds.length > 0) {
          return await this.endpointRepository.findByEvents(eventType);
        }
      }
    } catch {
      // Redis unavailable, fall through
    }

    return await this.endpointRepository.findByEvents(eventType);
  }

  @TraceDecorator()
  async isEndpointActive(endpointId: string) {
    try {
      const isConnected = await this.redisClient.isConnected();
      if (isConnected) {
        const active = await this.redisClient.get(`webhook:endpoint:${endpointId}:active`);
        if (active === '0') return false;
      }
    } catch {
      // Redis unavailable
    }

    const doc = await this.endpointRepository.findById(endpointId).catch(() => null);
    return doc ? doc.active : false;
  }

  @TraceDecorator()
  async checkRateLimit(endpointId: string, limit: number) {
    try {
      const key = `webhook:endpoint:${endpointId}:rl`;
      const count = await this.redisClient.incr(key);
      if (count === 1) {
        await this.redisClient.expire(key, 60);
      }
      return count <= limit;
    } catch {
      return true;
    }
  }

  private async syncCacheOnCreate(endpointId: string, events: string[]) {
    for (const event of events) {
      await this.redisClient.sadd(`webhook:events:${event}`, endpointId);
    }
  }

  private async syncCacheOnUpdate(endpointId: string, added: string[], removed: string[]) {
    for (const event of added) {
      await this.redisClient.sadd(`webhook:events:${event}`, endpointId);
    }
    for (const event of removed) {
      await this.redisClient.srem(`webhook:events:${event}`, endpointId);
    }
  }

  private encryptSecret(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private validateUrl(url: string) {
    if (url.length > 2048) {
      throw new AppError({
        message: 'URL exceeds maximum length of 2048 characters',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        throw new AppError({
          message: 'Only HTTPS URLs are allowed',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      const hostname = parsed.hostname;
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('192.168.') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.localhost')
      ) {
        throw new AppError({
          message: 'URL points to a private network (SSRF protection)',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      if (parsed.protocol !== 'https:') {
        throw new AppError({
          message: 'Only HTTPS URLs are allowed',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        message: 'Invalid URL format',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
  }
}
