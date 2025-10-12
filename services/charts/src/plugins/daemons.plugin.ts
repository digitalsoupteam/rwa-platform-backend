import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainEventsDaemon } from "../daemons/blockchainEvents.daemon";
import { ClientsPlugin } from "./clients.plugin";
import { ServicesPlugin } from "./services.plugin";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createDaemonsPlugin = async (
  clientsPlugin: ClientsPlugin,
  servicesPlugin: ServicesPlugin
) => {
  const blockchainEventsDaemon = withTraceSync(
    'charts.init.daemons.blockchain_events',
    () => new BlockchainEventsDaemon(
      clientsPlugin.decorator.rabbitMQClient,
      servicesPlugin.decorator.chartsService,
      servicesPlugin.decorator.transactionsService
    )
  );

  await withTraceAsync(
    'charts.init.daemons.initialize',
    async () => {
      logger.debug("Initializing daemons");
      await blockchainEventsDaemon.initialize();
      await blockchainEventsDaemon.start();
    }
  );

  const plugin = withTraceSync(
    'charts.init.daemons.plugin',
    () => new Elysia({ name: "Daemons" })
      .use(clientsPlugin)
      .use(servicesPlugin)
      .decorate("blockchainEventsDaemon", blockchainEventsDaemon)
      .onStop(async () => {
        await withTraceAsync(
          'charts.stop.daemons',
          async () => {
            if (blockchainEventsDaemon) {
              await blockchainEventsDaemon.stop();
            }
          }
        );
      })
  );

  return plugin;
}

export type DaemonsPlugin = Awaited<ReturnType<typeof createDaemonsPlugin>>