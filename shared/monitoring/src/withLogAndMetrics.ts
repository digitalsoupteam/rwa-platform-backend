import { withLog, type WithLogOptions } from './withLog';
import { withMetrics, type WithMetricsOptions } from './withMetrics';

export interface WithLogAndMetricsOptions {
  log?: WithLogOptions;
  metrics?: WithMetricsOptions;
}

export function withLogAndMetrics<T extends (...args: any[]) => any>(options: WithLogAndMetricsOptions, fn: T): T {
  let wrapped = fn;

  if (options.metrics) {
    wrapped = withMetrics(options.metrics, wrapped);
  }

  if (options.log) {
    wrapped = withLog(options.log, wrapped);
  }

  return wrapped;
}
