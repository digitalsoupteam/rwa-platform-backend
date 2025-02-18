import { logger, metrics } from '@rwa-platform/shared/src';

export class EnterpriseAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.ENTERPRISE_SERVICE_URL || 'http://enterprise:3000';
  }

  private async fetchJson(path: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${this.baseURL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      logger.error(`EnterpriseAPI request failed: ${error.message}`);
      throw error;
    }
  }

  async getEnterprises() {
    try {
      const result = await this.fetchJson('/enterprises');
      metrics.increment('gateway.enterprise.list.success');
      return result;
    } catch (error: any) {
      metrics.increment('gateway.enterprise.list.failure');
      throw new Error(`Failed to get enterprises: ${error.message}`);
    }
  }

  async getEnterprise(id: string) {
    try {
      const result = await this.fetchJson(`/enterprises/${id}`);
      metrics.increment('gateway.enterprise.get.success');
      return result;
    } catch (error: any) {
      metrics.increment('gateway.enterprise.get.failure');
      throw new Error(`Failed to get enterprise: ${error.message}`);
    }
  }

  async getPools() {
    try {
      const result = await this.fetchJson('/pools');
      metrics.increment('gateway.pool.list.success');
      return result;
    } catch (error: any) {
      metrics.increment('gateway.pool.list.failure');
      throw new Error(`Failed to get pools: ${error.message}`);
    }
  }

  async getPool(id: string) {
    try {
      const result = await this.fetchJson(`/pools/${id}`);
      metrics.increment('gateway.pool.get.success');
      return result;
    } catch (error: any) {
      metrics.increment('gateway.pool.get.failure');
      throw new Error(`Failed to get pool: ${error.message}`);
    }
  }

  async createEnterprise(input: {
    name: string;
    productOwner: string;
    image: any;
    investmentPresentation: any;
    projectSummary: any;
  }) {
    try {
      const formData = new FormData();
      formData.append('name', input.name);
      formData.append('productOwner', input.productOwner);
      
      // Handle file uploads
      formData.append('image', input.image);
      formData.append('investmentPresentation', input.investmentPresentation);
      formData.append('projectSummary', input.projectSummary);

      const response = await fetch(`${this.baseURL}/enterprises`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      metrics.increment('gateway.enterprise.create.success');
      return result;
    } catch (error: any) {
      metrics.increment('gateway.enterprise.create.failure');
      throw new Error(`Failed to create enterprise: ${error.message}`);
    }
  }

  async requestSignatures(enterpriseId: string) {
    try {
      const result = await this.fetchJson(`/enterprises/${enterpriseId}/signatures`, {
        method: 'POST'
      });
      metrics.increment('gateway.enterprise.requestSignatures.success');
      return result;
    } catch (error: any) {
      metrics.increment('gateway.enterprise.requestSignatures.failure');
      throw new Error(`Failed to request signatures: ${error.message}`);
    }
  }

  async createPool(enterpriseId: string, input: { name: string; metadata?: Record<string, string> }) {
    try {
      const result = await this.fetchJson(`/enterprises/${enterpriseId}/pools`, {
        method: 'POST',
        body: JSON.stringify(input)
      });
      metrics.increment('gateway.pool.create.success');
      return result;
    } catch (error: any) {
      metrics.increment('gateway.pool.create.failure');
      throw new Error(`Failed to create pool: ${error.message}`);
    }
  }
}
