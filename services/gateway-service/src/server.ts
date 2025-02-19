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
import { enterpriseResolvers } from './resolvers/enterprise.resolver';
import { KYCAPI } from './datasources/kyc.api';
import { EnterpriseAPI } from './datasources/enterprise.datasource';
import { pubsub, EVENTS } from './pubsub';
import { metrics, logger } from '@rwa-platform/shared/src';

import { swagger } from '@elysiajs/swagger';
import mongoose from 'mongoose';
import { AuthAPI } from './datasources/auth.api';
import { authMiddleware, createAuthHandler } from './middleware/auth.middleware';

// Load schema
const typeDefs = loadSchemaSync(path.join(__dirname, './schemas/schema.graphql'), {
  loaders: [new GraphQLFileLoader()],
});

// Объединение резолверов
const resolvers = {
  Query: {
    ...authResolver.Query,
    ...healthResolver.Query,
    ...kycResolver.Query,
    ...enterpriseResolvers.Query,
  },
  Mutation: {
    ...authResolver.Mutation,
    ...kycResolver.Mutation,
    ...enterpriseResolvers.Mutation,
  },
  Subscription: {
    ...kycResolver.Subscription,
    ...enterpriseResolvers.Subscription,
  },
  Enterprise: enterpriseResolvers.Enterprise,
  Pool: enterpriseResolvers.Pool,
};

// Настройка RabbitMQ для обновлений
async function setupSubscriptions() {
  try {
    const connection = await connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const channel = await connection.createChannel();

    // KYC updates
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

    // Enterprise updates
    await channel.assertExchange('enterprise_events', 'topic', { durable: false });
    await channel.assertQueue('enterprise_updates');
    await channel.bindQueue('enterprise_updates', 'enterprise_events', 'enterprise.#');
    
    channel.consume('enterprise_updates', (msg: any) => {
      if (msg) {
        const update = JSON.parse(msg.content.toString());
        const routingKey = msg.fields.routingKey;
        
        if (routingKey.startsWith('enterprise.signatures.')) {
          const enterpriseId = routingKey.split('.')[2];
          channel.publish('', `enterprise.signatures.${enterpriseId}`, msg.content);
        } else if (routingKey.startsWith('enterprise.updates.')) {
          const enterpriseId = routingKey.split('.')[2];
          channel.publish('', `enterprise.updates.${enterpriseId}`, msg.content);
        }
        
        channel.ack(msg);
      }
    });

    logger.info('Subscriptions initialized');
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
            enterpriseAPI: new EnterpriseAPI(),
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

  .get('/metrics', () => {
    // Системные метрики
    const processMetrics = [
      `process_uptime_seconds ${process.uptime()}`,
      `process_heap_bytes ${process.memoryUsage().heapUsed}`,
      `process_rss_bytes ${process.memoryUsage().rss}`,
      `process_cpu_user_seconds ${process.cpuUsage().user}`,
      `process_cpu_system_seconds ${process.cpuUsage().system}`,
    ].join('\n');

    // Бизнес метрики
    const businessMetrics = metrics.prometheusFormat();

    return new Response(processMetrics + '\n' + businessMetrics, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  })

  .listen({
    hostname: '0.0.0.0',
    port: 3000,
  });

setupSubscriptions().catch(console.error);

console.log(`🚀 gateway-service is running at ${app.server?.hostname}:${app.server?.port}`);

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwa-platform')
  .then(() => console.log('📦 MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));
