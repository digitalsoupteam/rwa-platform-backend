import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { BlockchainScanner } from './blockchain-scanner';
import { logger } from '@rwa-platform/shared/src';
import { contracts } from './config/contracts';

const scanner = new BlockchainScanner(
  process.env.NETWORK_ID || '1',
  process.env.RPC_URL || 'http://localhost:8545',
  process.env.RABBITMQ_URL || 'amqp://localhost',
  process.env.REDIS_URL || 'redis://localhost',
  contracts,
  {
    batchSize: 10,
    retryDelay: 5000,
    maxRetries: 5
  }
);

// Инициализация сканера
scanner.initialize().then(() => {
  scanner.startScanning().catch(logger.error);
});

const app = new Elysia()
  .use(cors())
  .use(swagger())
  
  .get('/health', () => ({
    status: 'ok',
    service: 'blockchain-scanner',
    timestamp: new Date().toISOString(),
  }))

  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  }))

  .listen({
    hostname: '0.0.0.0',
    port: 3005,
  });

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => logger.info('📦 MongoDB connected'))
  .catch((err) => logger.error('MongoDB connection error:', err));

// Graceful shutdown
process.on('SIGTERM', async () => {
  scanner.stop();
  await mongoose.connection.close();
  process.exit(0);
});