import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { serverAdapter, kycQueue, blockchainQueue, notificationQueue } from './queues';
import { logger } from '@rwa-platform/shared/src';

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .use(serverAdapter.registerPlugin())

  .get('/', () => ({
    message: 'Welcome to worker-service',
    version: '1.0.0',
  }))

  .get('/health', () => ({
    status: 'ok',
    service: 'worker-service',
    timestamp: new Date().toISOString(),
  }))

  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  }))

  // Debug endpoints
  .post('/test/kyc', async ({ body }: any) => {
    const job = await kycQueue.add('process-kyc', body);
    return { jobId: job.id };
  })

  .post('/test/blockchain', async ({ body }: any) => {
    const job = await blockchainQueue.add('process-event', body);
    return { jobId: job.id };
  })

  .post('/test/notification', async ({ body }: any) => {
    const job = await notificationQueue.add('send-notification', body);
    return { jobId: job.id };
  })

  .listen({
    hostname: '0.0.0.0',
    port: 3006,
  });

logger.info(`🚀 worker-service is running at ${app.server?.hostname}:${app.server?.port}`);
logger.info('Bull Board UI available at http://localhost:3006/admin/queues');

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => console.log('📦 MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));
