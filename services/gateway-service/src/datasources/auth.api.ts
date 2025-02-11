import { logger, metrics } from '@rwa-platform/shared/src';
import { TypedDataResponse } from 'src/resolvers/auth.resolver';

interface AuthResponse {
  token: string;
}

export class AuthAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.AUTH_SERVICE_URL || 'http://auth:3001';
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
      logger.error(`AuthAPI request failed: ${error.message}`);
      throw error;
    }
  }

  async getNonce(address: string): Promise<TypedDataResponse> {
    try {
      const result = await this.fetchJson('/auth/nonce', {
        method: 'POST',
        body: JSON.stringify({ address }),
      });
      
      metrics.increment('gateway.auth.getNonce.success');
      return result;
    } catch (error: any) {
      metrics.increment('gateway.auth.getNonce.failure');
      throw new Error(`Failed to get nonce: ${error.message}`);
    }
  }

  async verifySignature(address: string, signature: string): Promise<string> {
    try {
      const response = await this.fetchJson('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ address, signature }),
      });
      
      if (!response.token) {
        throw new Error('No token in response');
      }

      metrics.increment('gateway.auth.verify.success');
      return response.token;
    } catch (error: any) {
      metrics.increment('gateway.auth.verify.failure');
      throw new Error(`Failed to verify signature: ${error.message}`);
    }
}
}