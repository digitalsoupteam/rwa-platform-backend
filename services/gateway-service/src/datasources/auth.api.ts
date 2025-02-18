import { BaseAPIClient } from '@rwa-platform/shared/src/utils/base-api-client';
import { TypedDataResponse } from 'src/resolvers/auth.resolver';

interface AuthResponse {
  token: string;
}

export class AuthAPI extends BaseAPIClient {
  constructor() {
    super(process.env.AUTH_SERVICE_URL || 'http://auth:3001', 'auth');
  }

  async getNonce(address: string): Promise<TypedDataResponse> {
    return this.fetchJson('/auth/nonce', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  async verifySignature(address: string, signature: string): Promise<string> {
    const response = await this.fetchJson<AuthResponse>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ address, signature }),
    });

    if (!response.token) {
      throw new Error('No token in response');
    }

    return response.token;
  }
}
