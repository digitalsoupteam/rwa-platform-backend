import { Elysia } from 'elysia';
import { yogaServer } from './graphql/server';
import { monitoringPlugin, logger } from '@shared/monitoring/src/monitoring.plugin';
import { healthPlugin } from '@shared/monitoring/src/health.plugin';
import { metrics } from '@shared/monitoring/src/metrics';

new Elysia({
  serve: {
    idleTimeout: 30
  }
})
  .use(monitoringPlugin)
  .use(healthPlugin)
  .state('startTime', 0 as number)
  .onRequest(({ store }) => {
    store.startTime = performance.now();
  })
  .onAfterHandle(({ path, request, store, response }) => {
    const duration = performance.now() - store.startTime;
    const status = response instanceof Response ? response.status : 200;
    metrics.histogram('request_duration_ms', duration, { path, method: request.method });
    metrics.counter('requests_total', { path, method: request.method, status: String(status) });
  })
  .onError(({ path, request, store, error, code }) => {
    const duration = performance.now() - store.startTime;
    metrics.histogram('request_duration_ms', duration, { path, method: request.method });
    metrics.counter('requests_total', { path, method: request.method, status: String(code ?? 500) });
    metrics.counter('errors_total', { path, method: request.method, error_type: error?.name ?? 'unknown' });
  })
  .all('/graphql', (context) => yogaServer.handle(context.request))
  .all('/graphql/stream', (context) => yogaServer.handle(context.request))
  .listen(3000);

logger.info('Server is running on http://localhost:3000/graphql');
