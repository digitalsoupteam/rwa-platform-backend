import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainEventsDaemon } from "../daemons/blockchainEvents.daemon";
import type { ClientsPlugin } from "./clients.plugin";
import type { ServicesPlugin } from "./services.plugin";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createDaemonsPlugin = async (
  clientsPlugin: ClientsPlugin,
  servicesPlugin: ServicesPlugin
) => {
  const blockchainEventsDaemon = withTraceSync(
    'rwa.init.daemons.blockchain_events',
    () => new BlockchainEventsDaemon(
      clientsPlugin.decorator.rabbitMQClient,
      servicesPlugin.decorator.businessService,
      servicesPlugin.decorator.poolService,
    )
  );

  await withTraceAsync(
    'rwa.init.daemons.initialize',
    async () => {
      logger.debug("Initializing daemons");
      await blockchainEventsDaemon.initialize();
      await blockchainEventsDaemon.start();
      logger.info("Blockchain events daemon started");
    }
  );

  const plugin = withTraceSync(
    'rwa.init.daemons.plugin',
    () => new Elysia({ name: "Daemons" })
      .use(clientsPlugin)
      .use(servicesPlugin)
      .decorate("blockchainEventsDaemon", blockchainEventsDaemon)
      .onStop(async () => {
        await withTraceAsync(
          'rwa.stop.daemons',
          async () => {
            if (blockchainEventsDaemon) {
              await blockchainEventsDaemon.stop();
              logger.info("Blockchain events daemon stopped");
            }
          }
        );
      })
  );

  return plugin;
}

export type DaemonsPlugin = Awaited<ReturnType<typeof createDaemonsPlugin>>