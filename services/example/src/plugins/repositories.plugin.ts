import { Elysia } from 'elysia';
import mongoose from 'mongoose';
import { ExampleRepository } from '../repositories/example.repository';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const exampleRepository = withTraceSync('example.init.repositories.example', () => new ExampleRepository());

  await withTraceAsync('example.init.repositories_plugin.mongoose', async (ctx) => {
    mongoose.connection.once('connected', () => {
      ctx.end();
    });
    await mongoose.connect(mongoUri);
  });

  const plugin = withTraceSync('example.init.repositories.plugin', () =>
    new Elysia({ name: 'Repositories' }).decorate('exampleRepository', exampleRepository).onStop(async () => {
      await withTraceAsync('example.stop.repositories_plugin', async () => {
        await mongoose.disconnect();
      });
    }),
  );

  return plugin;
};

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>;
