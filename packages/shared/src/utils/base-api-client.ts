import { logger } from '../index';
import { metrics } from './monitoring';

export interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export class BaseAPIClient {
  constructor(
    private baseURL: string,
    private serviceName: string
  ) {}

  protected async fetchJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      const url = new URL(`${this.baseURL}${path}`);
      
      // Add query parameters if provided
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const response = await fetch(url.toString(), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      metrics.increment(`gateway.${this.serviceName}.request.success`);
      return result;
    } catch (error: any) {
      logger.error(`${this.serviceName} request failed: ${error.message}`);
      metrics.increment(`gateway.${this.serviceName}.request.error`);
      throw error;
    }
  }

  protected async fetchFormData<T>(path: string, formData: FormData, options: RequestOptions = {}): Promise<T> {
    try {
      const url = new URL(`${this.baseURL}${path}`);
      
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const response = await fetch(url.toString(), {
        ...options,
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      metrics.increment(`gateway.${this.serviceName}.request.success`);
      return result;
    } catch (error: any) {
      logger.error(`${this.serviceName} request failed: ${error.message}`);
      metrics.increment(`gateway.${this.serviceName}.request.error`);
      throw error;
    }
  }
}
