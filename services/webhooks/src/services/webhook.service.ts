import crypto from 'crypto';
import { isIP } from 'node:net';
import { AppError } from '@shared/errors/app-errors';
import { isAllowedHost, isPrivateAddress, normalizeHostname, resolveHostnameAddresses } from '../utils/ssrf';
import { EndpointRepository } from '../repositories/endpoint.repository';
import { RedisWithTracing } from '@shared/monitoring/src/redis';
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
    private readonly redisClient: RedisWithTracing,
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

    await this.validateUrl(data.url);

    const count = await this.endpointRepository.countByUser(data.userId);
    if (count >= MAX_ENDPOINTS_PER_USER) {
      throw new AppError({
        message: `Maximum ${MAX_ENDPOINTS_PER_USER} webhook endpoints per user`,
        statusCode: 400,
        code: 'LIMIT_EXCEEDED',
      });
    }

    // Standard Webhooks secret format (`whsec_` + base64 of 32 bytes):
    // verifier libraries for the standard scheme consume it as-is.
    const rawSecret = `whsec_${crypto.randomBytes(32).toString('base64')}`;
    const encryptedSecret = this.encryptSecret(rawSecret);

    const doc = await this.endpointRepository.createEndpoint({
      userId: data.userId,
      wallet: data.wallet,
      url: data.url,
      secret: encryptedSecret,
      events: data.events,
      description: data.description || '',
      rateLimitPerMinute: data.rateLimitPerMinute ?? 100,
    });

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
      await this.validateUrl(data.url);
    }

    let newSecret: string | undefined;
    if (data.url && data.url !== existing.url) {
      newSecret = `whsec_${crypto.randomBytes(32).toString('base64')}`;
    }

    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.userId;
    delete updateData.wallet;
    if (newSecret) {
      updateData.secret = this.encryptSecret(newSecret);
    }

    const doc = await this.endpointRepository.updateEndpoint(data.id, updateData);

    if (data.active !== undefined) {
      if (!data.active) {
        await this.redisClient.set(`webhook:endpoint:${doc._id.toString()}:active`, '0', 'EX', 3600);
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

    await this.redisClient.del(`webhook:endpoint:${doc._id.toString()}:active`);

    return { id: data.id };
  }

  @TraceDecorator()
  async findEndpointsByEvent(eventType: string) {
    // The database is the source of truth for subscriptions; a Redis index
    // would go stale on flushes and make subscribers miss events.
    return await this.endpointRepository.findByEvents(eventType);
  }

  @TraceDecorator()
  async isEndpointActive(endpointId: string) {
    try {
      const isConnected = this.redisClient.status === 'ready';
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

  private encryptSecret(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private async validateUrl(url: string) {
    if (url.length > 2048) {
      throw new AppError({
        message: 'URL exceeds maximum length of 2048 characters',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new AppError({
        message: 'Invalid URL format',
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

    const hostname = normalizeHostname(parsed.hostname);

    // Dev/test escape hatch: an explicitly allowlisted host (SSRF_ALLOWED_HOSTS)
    // skips the private-address check — the e2e receiver on the Docker host.
    if (isAllowedHost(hostname)) {
      return;
    }

    const addresses = isIP(hostname) ? [hostname] : await resolveHostnameAddresses(hostname);

    if (addresses.length === 0) {
      throw new AppError({
        message: 'Failed to resolve hostname',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    if (addresses.some(isPrivateAddress)) {
      throw new AppError({
        message: 'URL points to a private network (SSRF protection)',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
  }
}
