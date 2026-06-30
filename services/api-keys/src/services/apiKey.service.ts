import crypto from 'crypto';
import { AppError } from '@shared/errors/app-errors';
import { ApiKeyRepository } from '../repositories/apiKey.repository';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';
import { metrics } from '@shared/monitoring/src/metrics';

export class ApiKeyService {
  constructor(private readonly apiKeyRepository: ApiKeyRepository) {}

  /**
   * Creates a new API key
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ userId: a[0].userId, name: a[0].name }),
  })
  async createApiKey(data: { userId: string; wallet: string; name: string }) {
    setSpanAttributes({ userId: data.userId });

    const rawKey = 'apikey_' + crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.slice(0, 13);

    const doc = await this.apiKeyRepository.create({
      userId: data.userId,
      wallet: data.wallet,
      name: data.name,
      keyHash,
      prefix,
    });

    metrics.counter('api_keys_created_total');

    return {
      id: doc._id.toString(),
      name: doc.name,
      prefix: doc.prefix,
      key: rawKey,
      createdAt: doc.createdAt,
    };
  }

  /**
   * Deletes an API key by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, userId: a[0].userId }),
  })
  async deleteApiKey(params: { id: string; userId: string }) {
    setSpanAttributes({ apiKeyId: params.id, userId: params.userId });
    await this.apiKeyRepository.delete(params);
    return { id: params.id };
  }

  /**
   * Gets an API key by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, userId: a[0].userId }),
  })
  async getApiKey(params: { id: string; userId: string }) {
    setSpanAttributes({ apiKeyId: params.id, userId: params.userId });
    const doc = await this.apiKeyRepository.findById(params);
    return {
      id: doc._id.toString(),
      name: doc.name,
      prefix: doc.prefix,
      userId: doc.userId,
      wallet: doc.wallet,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Lists all API keys for a user
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ userId: a[0].userId }),
  })
  async getApiKeys(params: { userId: string }) {
    setSpanAttributes({ userId: params.userId });
    const docs = await this.apiKeyRepository.findAll({ userId: params.userId });
    return docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      prefix: doc.prefix,
      userId: doc.userId,
      wallet: doc.wallet,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  /**
   * Updates an API key name
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0].id, userId: a[0].userId, name: a[0].name }),
  })
  async updateApiKey(params: { id: string; userId: string; name: string }) {
    setSpanAttributes({ apiKeyId: params.id, userId: params.userId });
    const doc = await this.apiKeyRepository.update(params);
    return {
      id: doc._id.toString(),
      name: doc.name,
      prefix: doc.prefix,
      userId: doc.userId,
      wallet: doc.wallet,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Validates an API key and returns user info
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ keyPrefix: a[0].slice(0, 13) }),
  })
  async validateApiKey(apiKey: string) {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const doc = await this.apiKeyRepository.findByKeyHash(keyHash);
    return {
      userId: doc.userId,
      wallet: doc.wallet,
    };
  }
}
