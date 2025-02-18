import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger } from '@rwa-platform/shared/src';
import { SignerHandler } from './handlers/signer.handler';

const startServer = async () => {
  // Initialize RabbitMQ
  const rabbitmq = new RabbitMQClient({
    url: process.env.RABBITMQ_URL || 'amqp://rabbitmq',
  });
  await rabbitmq.connect();

  // Initialize signer handler
  const signerHandler = new SignerHandler(rabbitmq, process.env.SIGNER_PRIVATE_KEY || '');
  await signerHandler.initialize();

  // Setup basic HTTP server for health checks
  const app = new Elysia()
    .use(cors())
    .get('/health', () => ({ status: 'ok' }))
    .get('/address', () => ({ address: signerHandler.getAddress() }))
    .listen({
      hostname: '0.0.0.0',
      port: 3012,
    });
    
  logger.info('Signer service started');
  return app;
};

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
