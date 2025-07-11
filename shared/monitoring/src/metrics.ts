import { Registry, Counter, Gauge, Histogram } from "prom-client";
import { logger } from "./logger";

export class Metrics {
  private registry: Registry;
  private counters: Map<string, Counter>;
  private gauges: Map<string, Gauge>;
  private histograms: Map<string, Histogram>;
  private readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;

    // Initialize registry and metrics storage
    this.registry = new Registry();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();

    // Set default labels for all metrics
    this.registry.setDefaultLabels({
      service: this.serviceName,
    });
  }

  counter(name: string, labels?: Record<string, string>): void {
    const metricName = `${this.serviceName}_${name}`;

    if (!this.counters.has(metricName)) {
      this.counters.set(
        metricName,
        new Counter({
          name: metricName,
          help: `Counter metric for ${name} in ${this.serviceName}`,
          labelNames: labels ? Object.keys(labels) : [],
          registers: [this.registry],
        })
      );
    }

    this.counters.get(metricName)?.inc(labels || {});
  }

  batchCounter(name: string, count: number, labels?: Record<string, string>): void {
    const metricName = `${this.serviceName}_${name}`;
  
    if (!this.counters.has(metricName)) {
      this.counters.set(
        metricName,
        new Counter({
          name: metricName,
          help: `Counter metric for ${name} in ${this.serviceName}`,
          labelNames: labels ? Object.keys(labels) : [],
          registers: [this.registry],
        })
      );
    }
  
    // Increment counter multiple times based on count
    this.counters.get(metricName)?.inc(labels || {}, count);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const metricName = `${this.serviceName}_${name}`;

    if (!this.gauges.has(metricName)) {
      this.gauges.set(
        metricName,
        new Gauge({
          name: metricName,
          help: `Gauge metric for ${name} in ${this.serviceName}`,
          labelNames: labels ? Object.keys(labels) : [],
          registers: [this.registry],
        })
      );
    }

    this.gauges.get(metricName)?.set(labels || {}, value);
  }

  histogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const metricName = `${this.serviceName}_${name}`;

    if (!this.histograms.has(metricName)) {
      this.histograms.set(
        metricName,
        new Histogram({
          name: metricName,
          help: `Histogram metric for ${name} in ${this.serviceName}`,
          labelNames: labels ? Object.keys(labels) : [],
          registers: [this.registry],
          // Default buckets optimized for typical HTTP response times (in seconds)
          // 0.1s (100ms) - Very fast responses
          // 0.5s (500ms) - Normal responses
          // 1s - Slower responses
          // 2s - Very slow responses
          // 5s - Potentially problematic responses
          buckets: [0.1, 0.5, 1, 2, 5],
        })
      );
    }

    this.histograms.get(metricName)?.observe(labels || {}, value);
  }

  async getMetrics(): Promise<string> {
    try {
      return await this.registry.metrics();
    } catch (error) {
      logger.error("Error collecting metrics from registry:", error);
      throw new Error("Failed to collect metrics from Prometheus registry");
    }
  }
}

export const metrics = new Metrics(process.env.SERVICE_NAME || "unknown-service");
