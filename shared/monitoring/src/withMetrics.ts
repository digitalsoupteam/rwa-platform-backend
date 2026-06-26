import { metrics } from './metrics';
import { AppError } from '@shared/errors/app-errors';

export interface WithMetricsOptions {
  name: string;
  labels?: Record<string, string>;
}

export function withMetrics<T extends (...args: any[]) => any>(options: WithMetricsOptions, fn: T): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const counterName = `${options.name}_total`;
    const histogramName = `${options.name}_duration`;
    const startTime = performance.now();

    const record = (result: 'success' | 'error', errorType?: string) => {
      const duration = performance.now() - startTime;
      metrics.counter(counterName, {
        result,
        ...(errorType ? { errorType } : {}),
        ...options.labels,
      });
      metrics.histogram(histogramName, duration, { result, ...options.labels });
    };

    try {
      const result = fn(...args);

      if (result && typeof result.then === 'function') {
        return result
          .then((value: any) => {
            record('success');
            return value;
          })
          .catch((error: any) => {
            const errorType = error instanceof AppError ? error.code : 'UNEXPECTED';
            record('error', errorType);
            throw error;
          }) as any;
      }

      record('success');
      return result;
    } catch (error: any) {
      const errorType = error instanceof AppError ? error.code : 'UNEXPECTED';
      record('error', errorType);
      throw error;
    }
  }) as T;
}
