// auth-service/src/server.ts
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { authController } from './controllers/auth.controller';
import { logger } from '@rwa-platform/shared/src';

const app = new Elysia()
  .use(cors())
  .use(swagger())

  .get('/', () => ({
    message: 'Welcome to auth-service',
    version: '1.0.0',
  }))

  .get('/health', () => ({
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
  }))

  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  }))

  .post('/message', async ({ body }) => {
    try {
      const { address } = body as any;
      const result = await authController.getAuthMessage(address);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  })

  .post('/verify', async ({ body }) => {
    try {
      const { address, signature } = body as any;
      if (!address || !signature) {
        throw new Error('Address and signature are required');
      }
      const result = await authController.verifySignature(address, signature);
      if (!result || !result.token) {
        throw new Error('Failed to generate token');
      }
      return result;
    } catch (error: any) {
      logger.error(`Verification failed: ${error.message}`);
      throw error;
    }
  })

  .listen({
    hostname: '0.0.0.0',
    port: 3001,
  });

console.log(`🚀 auth-service is running at ${app.server?.hostname}:${app.server?.port}`);

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => logger.info('📦 MongoDB connected'))
  .catch((err) => logger.error(`MongoDB connection error: ${err}`));
