import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';


let totalRequests = 0;
let errorRequests = 0;
let lastRequestTime = Date.now();

export const MetricsController = new Elysia()
  .onRequest(() => {
    totalRequests++;
    lastRequestTime = Date.now();
  })
  .onError(() => {
    errorRequests++;
  })
  .get('/metrics', () => {
    logger.debug('Metrics requested');
    
    
    const metrics = [
      '# HELP gateway_requests_total Total number of requests',
      '# TYPE gateway_requests_total counter',
      `gateway_requests_total ${totalRequests}`,
      '',
      '# HELP gateway_errors_total Total number of errors',
      '# TYPE gateway_errors_total counter',
      `gateway_errors_total ${errorRequests}`,
      '',
      '# HELP gateway_last_request_timestamp_seconds Last request timestamp',
      '# TYPE gateway_last_request_timestamp_seconds gauge',
      `gateway_last_request_timestamp_seconds ${Math.floor(lastRequestTime / 1000)}`,
      '',
      '# HELP gateway_uptime_seconds Gateway uptime in seconds',
      '# TYPE gateway_uptime_seconds gauge',
      `gateway_uptime_seconds ${process.uptime()}`,
    ].join('\n');

    return new Response(metrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
      },
    });
  });