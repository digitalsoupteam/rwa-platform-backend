// auth-service/src/server.ts
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { authController } from './controllers/auth.controller';
import { jwtMiddleware } from './middleware/jwt.middleware';
import { logger } from '@rwa-platform/shared/src';

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .use(jwtMiddleware)

  .get('/', () => ({
    message: 'Welcome to auth-service',
    version: '1.0.0'
  }))

  .get('/health', () => ({
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  }))

  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  }))

  .post('/auth/nonce', async ({ body }) => {
    const { address } = body as any;
    return await authController.getNonce(address);
  })

  .post('/auth/verify', async ({ body }) => {
    const { address, signature } = body as any;
    return await authController.verifySignature(address, signature);
  })

  .listen({
    hostname: '0.0.0.0',
    port: 3001
  });

console.log(`🚀 auth-service is running at ${app.server?.hostname}:${app.server?.port}`);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => logger.info('📦 MongoDB connected'))
  .catch(err => logger.error(`MongoDB connection error: ${err}`));
