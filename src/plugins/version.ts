import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import config from '../config/config';

export const versionPlugin: FastifyPluginAsync = fp(async (fastify: FastifyInstance) => {
  if (!fastify.hasDecorator('version')) {
    fastify.decorate('version', config.server.defaultVersion);
  }

  fastify.addHook('onRequest', async (request) => {
    const version = request.headers['api-version'] as string;
    if (version && config.server.supportedVersions.includes(version)) {
      request.version = version;
    } else {
      request.version = config.server.defaultVersion;
    }
  });
});
