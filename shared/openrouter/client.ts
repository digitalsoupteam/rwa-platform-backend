import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { metrics } from '@shared/monitoring/src/metrics';
import { AppError } from '@shared/errors/app-errors';
import type {
  OpenRouterCompletionRequest,
  OpenRouterChatCompletionRequest,
  OpenRouterCompletionResponse,
  OpenRouterChatCompletionResponse,
  OpenRouterGenerationMetadata,
  OpenRouterModelsResponse,
} from './types';
import { camelToSnakeCase, snakeToCamelCase } from './mappers';

export class OpenRouterClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {
    if (!this.apiKey) {
      throw new AppError({
        message: 'OpenRouter API key is not configured',
        statusCode: 500,
        code: 'CONFIG_ERROR',
      });
    }
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator()
  async completion(request: OpenRouterCompletionRequest): Promise<OpenRouterCompletionResponse> {
    const startTime = performance.now();
    const model = request.model || 'unknown';

    try {
      const snakeCaseRequest = camelToSnakeCase(request);

      const response = await fetch(`${this.baseUrl}/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(snakeCaseRequest),
      });

      const duration = performance.now() - startTime;
      metrics.histogram('openrouter_request_duration', duration, { model, type: 'completion' });

      if (!response.ok) {
        const errorText = await response.text();
        metrics.counter('openrouter_requests_total', {
          model,
          result: 'error',
          type: 'completion',
        });
        logger.error('OpenRouter API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new AppError({
          message: `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`,
          statusCode: 502,
          code: 'UPSTREAM_ERROR',
        });
      }

      const snakeCaseData = await response.json();

      const data = snakeToCamelCase<OpenRouterCompletionResponse>(snakeCaseData);

      metrics.counter('openrouter_requests_total', {
        model,
        result: 'success',
        type: 'completion',
      });

      return data;
    } catch (error) {
      const duration = performance.now() - startTime;
      metrics.histogram('openrouter_request_duration', duration, { model, type: 'completion' });
      metrics.counter('openrouter_requests_total', { model, result: 'error', type: 'completion' });
      logger.error('Error in OpenRouter completion request', { error });
      throw new AppError({
        message: 'Unknown error in OpenRouter completion request',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
        cause: error,
      });
    }
  }

  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator()
  async chatCompletion(request: OpenRouterChatCompletionRequest): Promise<OpenRouterChatCompletionResponse> {
    const startTime = performance.now();
    const model = request.model || 'unknown';

    try {
      const snakeCaseRequest = camelToSnakeCase(request);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(snakeCaseRequest),
      });

      const duration = performance.now() - startTime;
      metrics.histogram('openrouter_request_duration', duration, { model, type: 'chat' });

      if (!response.ok) {
        const errorText = await response.text();
        metrics.counter('openrouter_requests_total', { model, result: 'error', type: 'chat' });
        logger.error('OpenRouter Chat API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new AppError({
          message: `OpenRouter Chat API error: ${response.status} ${response.statusText} - ${errorText}`,
          statusCode: 502,
          code: 'UPSTREAM_ERROR',
        });
      }

      const snakeCaseData = await response.json();

      const data = snakeToCamelCase<OpenRouterChatCompletionResponse>(snakeCaseData);

      metrics.counter('openrouter_requests_total', { model, result: 'success', type: 'chat' });

      return data;
    } catch (error) {
      const duration = performance.now() - startTime;
      metrics.histogram('openrouter_request_duration', duration, { model, type: 'chat' });
      metrics.counter('openrouter_requests_total', { model, result: 'error', type: 'chat' });
      logger.error('Error in OpenRouter chat completion request', { error });
      throw new AppError({
        message: 'Unknown error in OpenRouter chat completion request',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
        cause: error,
      });
    }
  }

  @TraceDecorator()
  @LogDecorator()
  async getGeneration(generationId: string): Promise<OpenRouterGenerationMetadata> {
    try {
      const url = new URL(`${this.baseUrl}/generation`);
      url.searchParams.append('id', generationId);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('OpenRouter Generation API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new AppError({
          message: `OpenRouter Generation API error: ${response.status} ${response.statusText} - ${errorText}`,
          statusCode: 502,
          code: 'UPSTREAM_ERROR',
        });
      }

      const snakeCaseData = await response.json();

      const data = snakeToCamelCase<OpenRouterGenerationMetadata>(snakeCaseData);

      return data;
    } catch (error) {
      logger.error('Error fetching generation metadata', { error });
      throw new AppError({
        message: 'Unknown error fetching generation metadata',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
        cause: error,
      });
    }
  }

  @TraceDecorator()
  @LogDecorator()
  async getModels(): Promise<OpenRouterModelsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('OpenRouter Models API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new AppError({
          message: `OpenRouter Models API error: ${response.status} ${response.statusText} - ${errorText}`,
          statusCode: 502,
          code: 'UPSTREAM_ERROR',
        });
      }

      const snakeCaseData = await response.json();

      const data = snakeToCamelCase<OpenRouterModelsResponse>(snakeCaseData);

      return data;
    } catch (error) {
      logger.error('Error fetching models list', { error });
      throw new AppError({
        message: 'Unknown error fetching models list',
        statusCode: 502,
        code: 'UPSTREAM_ERROR',
        cause: error,
      });
    }
  }
}
