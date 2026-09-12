import { metrics } from './metrics';
import { camelToSnakeCase } from './decorator-utils';
import { AppError } from '@shared/errors/app-errors';

export interface MetricsOptions {
  name?: string;
  labels?: Record<string, string>;
}

export function MetricsDecorator(options?: MetricsOptions) {
  return function (originalMethod: any, context: ClassMethodDecoratorContext) {
    const methodName = String(context.name);

    return function replacementMethod(this: any, ...args: any[]) {
      const className = camelToSnakeCase(this.constructor.name);
      const metricName = options?.name ?? `${className}.${camelToSnakeCase(methodName)}`;
      const counterName = `${metricName}_total`;
      const histogramName = `${metricName}_duration`;
      const startTime = performance.now();

      try {
        const result = originalMethod.apply(this, args);

        if (result && typeof result.then === 'function') {
          return result
            .then((value: any) => {
              const duration = performance.now() - startTime;
              metrics.counter(counterName, { result: 'success', ...options?.labels });
              metrics.histogram(histogramName, duration);
              return value;
            })
            .catch((error: any) => {
              const duration = performance.now() - startTime;
              const errorType = error instanceof AppError ? error.code : 'UNEXPECTED';
              metrics.counter(counterName, { result: 'error', errorType, ...options?.labels });
              metrics.histogram(histogramName, duration);
              throw error;
            });
        }

        const duration = performance.now() - startTime;
        metrics.counter(counterName, { result: 'success', ...options?.labels });
        metrics.histogram(histogramName, duration);
        return result;
      } catch (error: any) {
        const duration = performance.now() - startTime;
        const errorType = error instanceof AppError ? error.code : 'UNEXPECTED';
        metrics.counter(counterName, { result: 'error', errorType, ...options?.labels });
        metrics.histogram(histogramName, duration);
        throw error;
      }
    };
  };
}
