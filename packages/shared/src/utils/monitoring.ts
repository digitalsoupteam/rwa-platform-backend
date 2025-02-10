import { MetricData } from '../interfaces';
import { METRICS_PREFIX } from '../constants';

class Metrics {
  private prefix: string;
  private metrics: Map<string, MetricData>;

  constructor(prefix: string = METRICS_PREFIX) {
    this.prefix = prefix;
    this.metrics = new Map();
  }

  private formatMetricName(name: string): string {
    return `${this.prefix}_${name}`;
  }

  increment(metric: string, labels: Record<string, string> = {}) {
    const name = this.formatMetricName(metric);
    const existing = this.metrics.get(name);
    
    this.metrics.set(name, {
      name,
      value: (existing?.value || 0) + 1,
      labels,
      timestamp: Date.now()
    });
  }

  gauge(metric: string, value: number, labels: Record<string, string> = {}) {
    const name = this.formatMetricName(metric);
    
    this.metrics.set(name, {
      name,
      value,
      labels,
      timestamp: Date.now()
    });
  }

  getMetrics(): MetricData[] {
    return Array.from(this.metrics.values());
  }

  // Метод для Prometheus формата
  prometheusFormat(): string {
    return Array.from(this.metrics.values())
      .map(metric => {
        const labels = Object.entries(metric.labels || {})
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        
        return `${metric.name}${labels ? `{${labels}}` : ''} ${metric.value} ${metric.timestamp}`;
      })
      .join('\n');
  }
}

export const metrics = new Metrics();
