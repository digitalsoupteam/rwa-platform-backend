import { FastifyInstance } from 'fastify';
import authRoutes from './auth.routes';

export default async function v1Routes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('API-Version', 'v1');
    if (request.version !== 'v1') {
      reply.header('Deprecation', 'true');
      reply.header('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString());
    }
  });

  fastify.register(authRoutes, { prefix: '/auth' });
}
