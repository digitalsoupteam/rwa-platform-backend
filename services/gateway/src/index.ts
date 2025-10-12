import { Elysia } from 'elysia';
// import { instrumentation } from './instrumentation';
import { yogaServer } from './graphql/server';
import { monitoringPlugin } from '@shared/monitoring/src/monitoring.plugin';

console.log('[GATEWAY TRACING] Configuration:', {
  serviceName: process.env.OTEL_SERVICE_NAME || 'gateway',
  endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://alloy:4320/v1/traces',
  protocol: process.env.OTEL_EXPORTER_OTLP_PROTOCOL || 'http/protobuf'
});

const app = new Elysia({
  serve: {
    idleTimeout: 30
  }
})
  .use(monitoringPlugin)
  .all('/graphql', (context) => yogaServer.handle(context.request))
  .all('/graphql/stream', (context) => yogaServer.handle(context.request))
  .listen(3000);

console.info('Server is running on http://localhost:3000/graphql');