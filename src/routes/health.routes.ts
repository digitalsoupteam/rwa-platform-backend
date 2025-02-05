import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string' },
                redis: { type: 'string' },
                rabbitmq: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async () => {
      return {
        status: 'ok',
        version: fastify.version,
        timestamp: new Date().toISOString(),
        services: {
          database: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
          redis: 'healthy', // Добавьте проверку Redis
          rabbitmq: 'healthy', // Добавьте проверку RabbitMQ
        },
      };
    },
  });
}
