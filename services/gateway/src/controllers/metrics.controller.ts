// DEPRECATED — replaced by OTel request-level metrics in index.ts
// Old approach: manual Prometheus-format /metrics endpoint (never mounted, redundant)
// New approach: metrics.histogram('request_duration_ms') + metrics.counter('requests_total')
//   via .onRequest / .onAfterHandle / .onError hooks in services/gateway/src/index.ts
//
// Metrics now flow via OTLP → Alloy → Prometheus, same as all other services.
