import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { WebhookEventsDaemon } from '../daemons/webhookEvents.daemon';
import { DeliveryDaemon } from '../daemons/delivery.daemon';
import type { ClientsPlugin } from './clients.plugin';
import type { ServicesPlugin } from './services.plugin';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';

export const createDaemonsPlugin = async (clientsPlugin: ClientsPlugin, servicesPlugin: ServicesPlugin) => {
  const webhookEventsDaemon = withTraceSync(
    'webhooks.init.daemons.webhook_events',
    () =>
      new WebhookEventsDaemon(
        clientsPlugin.decorator.webhookEventsClient,
        clientsPlugin.decorator.webhookDeliveryClient,
        clientsPlugin.decorator.redisClient,
        servicesPlugin.decorator.webhookService,
        servicesPlugin.decorator.deliveryService,
      ),
  );

  const deliveryDaemon = withTraceSync(
    'webhooks.init.daemons.delivery',
    () => new DeliveryDaemon(clientsPlugin.decorator.webhookDeliveryClient, servicesPlugin.decorator.deliveryService),
  );

  await withTraceAsync('webhooks.init.daemons.initialize', async () => {
    logger.debug('Initializing daemons');
    await webhookEventsDaemon.initialize();
    await deliveryDaemon.initialize();
    logger.info('Webhook daemons initialized');
  });

  const plugin = withTraceSync('webhooks.init.daemons.plugin', () =>
    new Elysia({ name: 'Daemons' })
      .use(clientsPlugin)
      .use(servicesPlugin)
      .decorate('webhookEventsDaemon', webhookEventsDaemon)
      .decorate('deliveryDaemon', deliveryDaemon)
      .onStop(async () => {
        logger.info('Daemons stopped');
      }),
  );

  return plugin;
};

export type DaemonsPlugin = Awaited<ReturnType<typeof createDaemonsPlugin>>;
