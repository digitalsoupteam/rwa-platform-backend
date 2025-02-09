import Fastify, { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import config from './config/config';
import v1Routes from './routes/v1';
import { registerPlugins } from './plugins';
import { BlockchainWorker } from './workers/blockchain/worker';

export const createServer = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    disableRequestLogging: process.env.NODE_ENV === 'test',
    forceCloseConnections: true,
    pluginTimeout: 0,
    ajv: {
      customOptions: {
        removeAdditional: false,
        useDefaults: true,
        coerceTypes: true,
        allErrors: true,
      },
    },
  });

  await registerPlugins(fastify);

  fastify.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            version: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
    handler: async () => ({
      status: 'ok',
      version: fastify.version,
      timestamp: new Date().toISOString(),
    }),
  });

  fastify.register(v1Routes, { prefix: '/api/v1' });

  fastify.get('/', async (_, reply) => {
    return reply.redirect('/api/v1');
  });

  await fastify.ready();
  return fastify;
};

export const startServer = async () => {
  const server = await createServer();

  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');

    await server.listen({ port: config.server.port });
    console.log(`Server running at port ${config.server.port}`);

    // Запуск blockchain worker'а
    const worker = new BlockchainWorker({
      ethereum: {
        rpcUrl: 'http://localhost:8545',
        networkId: 1,
        confirmations: 12,
      },
      sync: {
        batchSize: 10,
        maxRetries: 3,
        retryDelay: 1000,
      },
      mongodb: {
        uri: 'mongodb://localhost:27017',
        collection: 'blockchain_sync',
      },
      rabbitmq: {
        url: 'amqp://localhost',
        exchange: 'blockchain_events',
      },
    });

    await worker.initialize();
    await worker.start();

    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}
