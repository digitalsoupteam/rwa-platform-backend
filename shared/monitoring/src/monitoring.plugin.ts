import { opentelemetry } from '@elysiajs/opentelemetry';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

// OpenTelemetry Logs
import { LoggerProvider, BatchLogRecordProcessor, SimpleLogRecordProcessor, ConsoleLogRecordExporter } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { logs } from '@opentelemetry/api-logs';

// OpenTelemetry Metrics
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { metrics } from '@opentelemetry/api-metrics';

// OpenTelemetry Resource
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

console.log("PRELOADEDDDD")
const baseUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: process.env.SERVICE_NAME || 'unknown-service',
  [ATTR_SERVICE_VERSION]: '1.0.0',
  'deployment.environment': 'production',
});

const logExporter = new OTLPLogExporter({
  url: `${baseUrl}/v1/logs`,
});

const loggerProvider = new LoggerProvider({
  resource,
  processors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
    new BatchLogRecordProcessor(logExporter)
  ]
});
logs.setGlobalLoggerProvider(loggerProvider);

const metricExporter = new OTLPMetricExporter({
  url: `${baseUrl}/v1/metrics`,
});

const meterProvider = new MeterProvider({
  resource,
  readers: [new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 5000,
  })],
});
metrics.setGlobalMeterProvider(meterProvider);

const traceExporter = new OTLPTraceExporter({
  url: `${baseUrl}/v1/traces`,
  headers: {}
});
let a = 0
setInterval(() => {
  console.log(a)
}, 1000)

export const monitoringPlugin = opentelemetry({
  serviceName: process.env.SERVICE_NAME,
  resource,
  spanProcessors: [
    new BatchSpanProcessor(traceExporter)
  ],
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      applyCustomAttributesOnSpan: (span, request) => {
        span.setAttribute('http.service', String(process.env.SERVICE_NAME));
        span.setAttribute('service.name', String(process.env.SERVICE_NAME));
      },
    },
    '@opentelemetry/instrumentation-mongoose': {
      suppressInternalInstrumentation: true,
    },
    '@opentelemetry/instrumentation-graphql': {
      enabled: false,
    },
    '@opentelemetry/instrumentation-redis': {
      enabled: true,
      responseHook: () => {
        console.log('redisaw1requestHook')
      }
    },
    '@opentelemetry/instrumentation-ioredis': {
      enabled: true,
      requestHook: () => {
        console.log('ioredisaw1requestHook')
      },
      responseHook: () => {
        console.log('ioredisaw1responseHook')
      },
    },
    //   mergeItems: true,
    //   allowValues: true,
    //   depth: 2,
    //   responseHook(span, data) {
    //     a++
    //     console.log('GraphQL responseHook called!');
    //     console.log('Span:', span);
    //     console.log('Data:', JSON.stringify(data, null, 2));
        
    //     if (data && data.operationName) {
    //       console.log('Found operationName in data:', data.operationName);
    //       span.updateName(`GraphQL ${data.operationName}`);
    //     } else if (data && data.extensions && data.extensions.operationName) {
    //       console.log('Found operationName in extensions:', data.extensions.operationName);
    //       span.updateName(`GraphQL ${data.extensions.operationName}`);
    //     } else {
    //       console.log('No operationName found, data keys:', data ? Object.keys(data) : 'data is null/undefined');
    //     }
    //   },
    // },
    
    '@opentelemetry/instrumentation-dns': {
    },
    
    '@opentelemetry/instrumentation-fs': {
      enabled: true,
    },
    
    '@opentelemetry/instrumentation-net': {
    },
    
    '@opentelemetry/instrumentation-runtime-node': {
    },
  })],
})
