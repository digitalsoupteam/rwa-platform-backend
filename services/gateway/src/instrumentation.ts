import { opentelemetry } from '@elysiajs/opentelemetry';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://alloy:4320/v1/traces',
  headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? 
    JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {}
});

export const instrumentation = opentelemetry({
  serviceName: process.env.OTEL_SERVICE_NAME || 'gateway',
  spanProcessors: [
    new BatchSpanProcessor(traceExporter)
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        applyCustomAttributesOnSpan: (span, request) => {
          span.setAttribute('http.service', 'gateway');
          span.setAttribute('service.name', 'gateway');
        },
      },
      '@opentelemetry/instrumentation-graphql': {
        enabled: true
      }
    }),
  ],
});