import { Elysia } from 'elysia';
import { WebhookService } from '../services/webhook.service';
import { DeliveryService } from '../services/delivery.service';
import type { RepositoriesPlugin } from './repositories.plugin';
import type { ClientsPlugin } from './clients.plugin';
import { withTraceSync } from '@shared/monitoring/src/tracing';

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin,
  encryptionKey: string,
) => {
  const webhookService = withTraceSync(
    'webhooks.init.services.webhook',
    () =>
      new WebhookService(
        repositoriesPlugin.decorator.endpointRepository,
        clientsPlugin.decorator.redisClient,
        encryptionKey,
      ),
  );

  const deliveryService = withTraceSync(
    'webhooks.init.services.delivery',
    () =>
      new DeliveryService(
        repositoriesPlugin.decorator.deliveryLogRepository,
        repositoriesPlugin.decorator.endpointRepository,
        clientsPlugin.decorator.redisClient,
        encryptionKey,
      ),
  );

  const plugin = withTraceSync('webhooks.init.services.plugin', () =>
    new Elysia({ name: 'Services' })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate('webhookService', webhookService)
      .decorate('deliveryService', deliveryService),
  );

  return plugin;
};

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>;
