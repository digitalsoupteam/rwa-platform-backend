import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { yoga } from '@elysiajs/graphql-yoga';
import { connect } from 'amqplib';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { loadSchemaSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import path from 'path';
import { authResolver } from './resolvers/auth.resolver';
import { healthResolver } from './resolvers/health.resolver';
import { kycResolver } from './resolvers/kyc.resolver';
import { KYCAPI } from './datasources/kyc.api';
import { pubsub, EVENTS } from './pubsub';
import { logger } from '@rwa-platform/shared/src';

import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { AuthAPI } from './datasources/auth.api';
import { authMiddleware, createAuthHandler } from './middleware/auth.middleware';

// Загрузка схемы
const typeDefs = loadSchemaSync(path.join(__dirname, './schemas/**/*.graphql'), {
  loaders: [new GraphQLFileLoader()],
});

// Объединение резолверов
const resolvers = {
  Query: {
    ...authResolver.Query,
    ...healthResolver.Query,
    ...kycResolver.Query,
  },
  Mutation: {
    ...authResolver.Mutation,
    ...kycResolver.Mutation,
  },
  Subscription: {
    ...kycResolver.Subscription,
  },
};

// Настройка RabbitMQ для KYC обновлений
async function setupKYCUpdates() {
  try {
    const connection = await connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const channel = await connection.createChannel();

    await channel.assertQueue('kyc_updates');
    channel.consume('kyc_updates', (msg: any) => {
      if (msg) {
        const update = JSON.parse(msg.content.toString());
        pubsub.publish(EVENTS.KYC_STATUS_UPDATED, {
          kycStatusUpdated: update,
        });
        channel.ack(msg);
      }
    });

    logger.info('KYC updates subscription initialized');
  } catch (error: any) {
    logger.error('Failed to setup KYC updates:', error);
  }
}

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .use(authMiddleware)
  .use(
    yoga({
      schema: makeExecutableSchema({ typeDefs, resolvers }),
      context: ({ request }) => {
        const authAPI = new AuthAPI();
        const kycAPI = new KYCAPI();

        return {
          dataSources: {
            authAPI,
            kycAPI,
          },
          pubsub,
          auth: createAuthHandler(request),
        };
      },
    })
  )

  .get('/health', () => ({
    status: 'ok',
    service: 'gateway-service',
    timestamp: new Date().toISOString(),
  }))

  .get('/metrics', () => ({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  }))

  .listen({
    hostname: '0.0.0.0',
    port: 3000,
  });

setupKYCUpdates().catch(console.error);

console.log(`🚀 gateway-service is running at ${app.server?.hostname}:${app.server?.port}`);

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => console.log('📦 MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));
