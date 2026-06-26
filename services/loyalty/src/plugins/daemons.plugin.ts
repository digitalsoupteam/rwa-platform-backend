import { Elysia } from 'elysia';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { BlockchainEventsDaemon } from '../daemons/blockchainEvents.daemon';
import { withTraceSync, withTraceAsync } from '@shared/monitoring/src/tracing';
import type { ClientsPlugin } from './clients.plugin';
import type { ServicesPlugin } from './services.plugin';

export const createDaemonsPlugin = async (clientsPlugin: ClientsPlugin, servicesPlugin: ServicesPlugin) => {
  const blockchainEventsDaemon = withTraceSync(
    'loyalty.init.daemons.blockchain_events',
    () => new BlockchainEventsDaemon(clientsPlugin.decorator.rabbitMQClient, servicesPlugin.decorator.loyaltyService),
  );

  await withTraceAsync('loyalty.init.daemons.initialize', async () => {
    logger.debug('Initializing daemons');
    await blockchainEventsDaemon.initialize();
    await blockchainEventsDaemon.start();
    logger.info('Blockchain events daemon started');
  });

  const plugin = withTraceSync('loyalty.init.daemons.plugin', () =>
    new Elysia({ name: 'Daemons' })
      .use(clientsPlugin)
      .use(servicesPlugin)
      .decorate('blockchainEventsDaemon', blockchainEventsDaemon)
      .onStop(async () => {
        await withTraceAsync('loyalty.stop.daemons', async () => {
          if (blockchainEventsDaemon) {
            await blockchainEventsDaemon.stop();
            logger.info('Blockchain events daemon stopped');
          }
        });
      }),
  );

  return plugin;
};

export type DaemonsPlugin = Awaited<ReturnType<typeof createDaemonsPlugin>>;
