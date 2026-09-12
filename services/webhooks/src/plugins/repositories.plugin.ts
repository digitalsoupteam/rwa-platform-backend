import { Elysia } from 'elysia';
import mongoose from 'mongoose';
import { EndpointRepository } from '../repositories/endpoint.repository';
import { DeliveryLogRepository } from '../repositories/deliveryLog.repository';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const endpointRepository = withTraceSync('webhooks.init.repositories.endpoint', () => new EndpointRepository());
  const deliveryLogRepository = withTraceSync(
    'webhooks.init.repositories.delivery_log',
    () => new DeliveryLogRepository(),
  );

  await withTraceAsync('webhooks.init.repositories_plugin.mongoose', async (ctx) => {
    mongoose.connection.once('connected', () => {
      ctx.end();
    });
    await mongoose.connect(mongoUri);
  });

  const plugin = withTraceSync('webhooks.init.repositories.plugin', () =>
    new Elysia({ name: 'Repositories' })
      .decorate('endpointRepository', endpointRepository)
      .decorate('deliveryLogRepository', deliveryLogRepository)
      .onStop(async () => {
        await withTraceAsync('webhooks.stop.repositories_plugin', async () => {
          await mongoose.disconnect();
        });
      }),
  );

  return plugin;
};

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>;
