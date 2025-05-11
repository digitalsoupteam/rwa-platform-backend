import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/logger';

export const HealthController = new Elysia()
  .get('/health', () => {
    logger.debug('Health check requested');
    return {
      status: 'ok',
      // timestamp: new Date().toISOString(),
      // uptime: process.uptime(),
      // memory: process.memoryUsage(),
    };
  })
  .get('/health/ready', () => {
    logger.debug('Readiness check requested');
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  })
  .get('/health/live', () => {
    logger.debug('Liveness check requested');
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  });