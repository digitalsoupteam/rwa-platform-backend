import { BaseAPIClient } from '@rwa-platform/shared/src/utils/base-api-client';
import { logger } from '@rwa-platform/shared/src';
import { SignatureRequest } from 'src/resolvers/auth.resolver';

interface AuthResponse {
  token: string;
}

export class AuthAPI extends BaseAPIClient {
  constructor() {
    super(process.env.AUTH_SERVICE_URL || 'http://auth:3001', 'auth');
  }

  async getAuthMessage(address: string): Promise<SignatureRequest> {
    const result = await this.fetchJson<SignatureRequest>('/message', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
    return result;
  }

  async verifySignature(address: string, signature: string): Promise<string> {
    try {
      const response = await this.fetchJson<AuthResponse>('/verify', {
        method: 'POST',
        body: JSON.stringify({ address, signature }),
      });

      if (!response || !response.token) {
        throw new Error('No token in response');
      }

      return response.token;
    } catch (error: any) {
      logger.error(`Verify signature failed: ${error.message}`);
      throw new Error(error.message || 'Failed to verify signature');
    }
  }
}
