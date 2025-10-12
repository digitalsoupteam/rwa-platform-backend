import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { trace } from '@opentelemetry/api';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

console.log('🔧 Initializing direct OpenTelemetry test...');

const sdk = new NodeSDK({
  serviceName: 'test-direct-tracing',
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: 'http://alloy:4318/v1/traces',
      }),
      {
        scheduledDelayMillis: 1000, 
        exportTimeoutMillis: 5000,
        maxExportBatchSize: 1,
      }
    )
  ],
  autoDetectResources: true,
});

sdk.start();

console.log('✅ SDK initialized, creating test span...');

const tracer = trace.getTracer('test-tracer');

const span = tracer.startSpan('test-operation');
span.setAttributes({
  'test.attribute': 'test-value',
  'service.name': 'test-direct-tracing'
});

console.log('📊 Test span created:', {
  traceId: span.spanContext().traceId,
  spanId: span.spanContext().spanId
});

span.end();

console.log('🚀 Span ended, waiting for export...');

setTimeout(async () => {
  console.log('⏰ Forcing flush...');
  await sdk.shutdown();
  console.log('✅ SDK shutdown complete');
  
  console.log('');
  console.log('🔍 Now check Alloy logs for trace export messages');
  console.log('Expected to see messages about receiving traces');
  
  process.exit(0);
}, 3000);