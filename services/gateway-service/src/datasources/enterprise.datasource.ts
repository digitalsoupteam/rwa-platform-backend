import { BaseAPIClient } from '@rwa-platform/shared/src/utils/base-api-client';
import { Enterprise, Pool } from '../types/enterprise.types';

export class EnterpriseAPI extends BaseAPIClient {
  constructor() {
    super(process.env.ENTERPRISE_SERVICE_URL || 'http://enterprise:3000', 'enterprise');
  }

  async getEnterprises(): Promise<Enterprise[]> {
    return this.fetchJson('/enterprises');
  }

  async getEnterprise(id: string): Promise<Enterprise> {
    return this.fetchJson(`/enterprises/${id}`);
  }

  async getPools(): Promise<Pool[]> {
    return this.fetchJson('/pools');
  }

  async getPool(id: string): Promise<Pool> {
    return this.fetchJson(`/pools/${id}`);
  }

  async createEnterprise(input: {
    name: string;
    productOwner: string;
    image: any;
    investmentPresentation: any;
    projectSummary: any;
  }) {
    const formData = new FormData();
    formData.append('name', input.name);
    formData.append('productOwner', input.productOwner);
    formData.append('image', input.image);
    formData.append('investmentPresentation', input.investmentPresentation);
    formData.append('projectSummary', input.projectSummary);

    return this.fetchFormData('/enterprises', formData);
  }

  async requestSignatures(enterpriseId: string): Promise<Enterprise> {
    return this.fetchJson(`/enterprises/${enterpriseId}/signatures`, {
      method: 'POST'
    });
  }

  async createPool(enterpriseId: string, input: { name: string; metadata?: Record<string, any> }): Promise<Pool> {
    return this.fetchJson(`/enterprises/${enterpriseId}/pools`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }
}
