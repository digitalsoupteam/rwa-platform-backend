import { Elysia } from 'elysia';
import mongoose from 'mongoose';
import { ApiKeyRepository } from '../repositories/apiKey.repository';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const apiKeyRepository = withTraceSync('api-keys.init.repositories.api_key', () => new ApiKeyRepository());

  await withTraceAsync('api-keys.init.repositories_plugin.mongoose', async (ctx) => {
    mongoose.connection.once('connected', () => {
      ctx.end();
    });
    await mongoose.connect(mongoUri);
  });

  const plugin = withTraceSync('api-keys.init.repositories.plugin', () =>
    new Elysia({ name: 'Repositories' }).decorate('apiKeyRepository', apiKeyRepository).onStop(async () => {
      await withTraceAsync('api-keys.stop.repositories_plugin', async () => {
        await mongoose.disconnect();
      });
    }),
  );

  return plugin;
};

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>;
