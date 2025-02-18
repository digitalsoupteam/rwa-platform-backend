import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger } from '@rwa-platform/shared/src';
import { EnterpriseHandler } from './handlers/enterprise.handler';
import { RWAEnterprise } from './models/rwa-enterprise.model';
import { Pool } from './models/pool.model';

const app = new Elysia()
  .use(cors())
  .use(swagger());

const rabbitmq = new RabbitMQClient({
  url: process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672',
  exchanges: [
    {
      name: 'enterprise',
      type: 'direct',
      options: { durable: true }
    }
  ]
});

const enterpriseHandler = new EnterpriseHandler(rabbitmq);

// Connect to MongoDB and RabbitMQ
Promise.all([
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/rwa-platform'),
  rabbitmq.connect(),
  enterpriseHandler.initialize()
])
.then(() => {
  logger.info('📦 MongoDB connected');
  logger.info('🐰 RabbitMQ connected');
})
.catch((err) => {
  logger.error('Startup error:', err);
  process.exit(1);
});

// API Routes
app
  // Create new RWA Enterprise
  .post('/enterprise', async ({ body }) => {
    try {
      const enterprise = await enterpriseHandler.createEnterprise(body as any);
      return {
        success: true,
        data: enterprise
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error creating enterprise',
        error: error.message
      };
    }
  })

  // Get all enterprises
  .get('/enterprise', async () => {
    try {
      const enterprises = await RWAEnterprise.find().populate('pools');
      return {
        success: true,
        data: enterprises
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error fetching enterprises',
        error: error.message
      };
    }
  })

  // Get enterprise by ID
  .get('/enterprise/:id', async ({ params: { id } }) => {
    try {
      const enterprise = await RWAEnterprise.findById(id).populate('pools');
      if (!enterprise) {
        return {
          success: false,
          message: 'Enterprise not found'
        };
      }
      return {
        success: true,
        data: enterprise
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error fetching enterprise',
        error: error.message
      };
    }
  })

  // Request signatures for enterprise
  .post('/enterprise/:id/sign', async ({ params: { id } }) => {
    try {
      const enterprise = await enterpriseHandler.requestSignatures(id);
      return {
        success: true,
        data: enterprise
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error requesting signatures',
        error: error.message
      };
    }
  })

  // Create new pool for enterprise
  .post('/enterprise/:id/pool', async ({ params: { id }, body }) => {
    try {
      const pool = await enterpriseHandler.createPool(id, body as any);
      return {
        success: true,
        data: pool
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error creating pool',
        error: error.message
      };
    }
  })

  // Get all pools for enterprise
  .get('/enterprise/:id/pools', async ({ params: { id } }) => {
    try {
      const pools = await Pool.find({ rwaEnterprise: id });
      return {
        success: true,
        data: pools
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error fetching pools',
        error: error.message
      };
    }
  })

  .get('/', () => ({
    message: 'Welcome to enterprise-service',
    version: '1.0.0',
  }))
  
  .get('/health', () => ({
    status: 'ok',
    service: 'enterprise-service',
    timestamp: new Date().toISOString(),
  }))

  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  }))

  .listen({
    hostname: '0.0.0.0',
    port: 3003,
  });

console.log(`🚀 enterprise-service is running at ${app.server?.hostname}:${app.server?.port}`);
