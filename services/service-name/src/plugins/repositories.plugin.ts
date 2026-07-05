import { Elysia } from 'elysia';
import mongoose from 'mongoose';
import { SampleRepository } from '../repositories/sample.repository';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const sampleRepository = withTraceSync('<service-name>.init.repositories.sample', () => new SampleRepository());

  await withTraceAsync('<service-name>.init.repositories_plugin.mongoose', async (ctx) => {
    mongoose.connection.once('connected', () => {
      ctx.end();
    });
    await mongoose.connect(mongoUri);
  });

  const plugin = withTraceSync('<service-name>.init.repositories.plugin', () =>
    new Elysia({ name: 'Repositories' }).decorate('sampleRepository', sampleRepository).onStop(async () => {
      await withTraceAsync('<service-name>.stop.repositories_plugin', async () => {
        await mongoose.disconnect();
      });
    }),
  );

  return plugin;
};

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>;
