import { Redis } from 'ioredis';
import { CompanyClient } from '../clients/eden.clients';


export class CacheService {
  constructor(
    private redis: Redis,
    private companyClient: CompanyClient
  ) { }

  private getCompanyCacheKey(companyId: string) {
    return `company:${companyId}`;
  }

  async resetCompanyCache(companyId: string) {
    await this.redis.del(this.getCompanyCacheKey(companyId));
  }

  async getCompany(
    params: Parameters<CompanyClient['getCompany']['post']>[0]
  ): ReturnType<CompanyClient['getCompany']['post']> {
    const cacheKey = this.getCompanyCacheKey(params.id);

    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      console.log('Return cached company')
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