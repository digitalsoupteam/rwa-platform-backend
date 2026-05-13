import { Elysia } from 'elysia';

export const healthPlugin = new Elysia()
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: process.env.SERVICE_NAME || 'unknown'
  }));
