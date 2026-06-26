import { Redis } from 'ioredis';
import type { CompanyClient } from '../clients/eden.clients';

import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';

export class CacheService {
  constructor(
    private redis: Redis,
    private companyClient: CompanyClient,
  ) {}

  private getCompanyCacheKey(companyId: string) {
    return `company:${companyId}`;
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['companyId'] })
  async resetCompanyCache(companyId: string) {
    setSpanAttributes({ entityId: companyId });
    await this.redis.del(this.getCompanyCacheKey(companyId));
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({ args: ['params'] })
  async getCompany(
    params: Parameters<CompanyClient['getCompany']['post']>[0],
  ): ReturnType<CompanyClient['getCompany']['post']> {
    setSpanAttributes({ entityId: params.id });
    const cacheKey = this.getCompanyCacheKey(params.id);

    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      // @ts-ignore
      return { data: JSON.parse(cached), error: null };
    }

    // Get from API
    const response = await this.companyClient.getCompany.post(params);
    if (!response.error && response.data) {
      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(response.data));
    }

    return response;
  }
}
