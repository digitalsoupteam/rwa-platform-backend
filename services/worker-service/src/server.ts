import path from 'path';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { logger } from '@rwa-platform/shared/src';
import { ElysiaAdapter } from '@bull-board/elysia';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { TaskManager } from './tasks/task-manager';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { tasks } from './tasks/tasks';

const startServer = async () => {
  // Initialize RabbitMQ
  const rabbitmq = new RabbitMQClient({
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
  });
  await rabbitmq.connect();

  // Initialize Task Manager
  const taskManager = new TaskManager(rabbitmq, tasks, {
    port: 6379,
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD,
  });
  await taskManager.initialize();

  // Setup Bull Board
  const serverAdapter = new ElysiaAdapter('/admin/queues');
  createBullBoard({
    queues: taskManager.getQueues().map((queue: any) => new BullAdapter(queue)),
    serverAdapter,
    options: {
      uiConfig: {},
      uiBasePath: path.resolve(__dirname, '../../../node_modules/@bull-board/ui'),
    },
  });

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
    .listen({
      hostname: '0.0.0.0',
      port: 3006,
    });

  logger.info(`🚀 worker-service is running at ${app.server?.hostname}:${app.server?.port}`);
  logger.info('Bull Board UI available at http://localhost:3006/admin/queues');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform');
  logger.info('📦 MongoDB connected');
};

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
