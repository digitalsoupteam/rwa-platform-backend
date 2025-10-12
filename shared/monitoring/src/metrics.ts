import { metrics as metricsLib } from '@opentelemetry/api-metrics';

export class OTelMetrics {
  private otelMeter: any;
  private counters = new Map();
  private gauges = new Map();
  private histograms = new Map();
  private readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.otelMeter = metricsLib.getMeter(this.serviceName, '1.0.0');
  }

  counter(name: string, labels?: Record<string, string>): void {
    const metricName = `${this.serviceName}_${name}`;
    
    if (!this.counters.has(metricName)) {
      this.counters.set(metricName, this.otelMeter.createCounter(metricName, {
        description: `Counter metric for ${name} in ${this.serviceName}`,
      }));
    }
    
    this.counters.get(metricName).add(1, labels || {});
  }

  batchCounter(name: string, count: number, labels?: Record<string, string>): void {
    const metricName = `${this.serviceName}_${name}`;
    
    if (!this.counters.has(metricName)) {
      this.counters.set(metricName, this.otelMeter.createCounter(metricName, {
        description: `Counter metric for ${name} in ${this.serviceName}`,
      }));
    }
    
    this.counters.get(metricName).add(count, labels || {});
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const metricName = `${this.serviceName}_${name}`;
    
    if (!this.gauges.has(metricName)) {
      this.gauges.set(metricName, this.otelMeter.createUpDownCounter(metricName, {
        description: `Gauge metric for ${name} in ${this.serviceName}`,
      }));
    }
    
    this.gauges.get(metricName).add(value, labels || {});
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const metricName = `${this.serviceName}_${name}`;
    
    if (!this.histograms.has(metricName)) {
      this.histograms.set(metricName, this.otelMeter.createHistogram(metricName, {
        description: `Histogram metric for ${name} in ${this.serviceName}`,
        boundaries: [0.1, 0.5, 1, 2, 5],
      }));
    }
    
    this.histograms.get(metricName).record(value, labels || {});
  }
}

export const metrics = new OTelMetrics(process.env.SERVICE_NAME || "unknown-service2");