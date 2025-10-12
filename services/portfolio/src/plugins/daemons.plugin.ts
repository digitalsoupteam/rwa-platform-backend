import { Elysia } from "elysia";
import { BlockchainEventsDaemon } from "../daemons/blockchainEvents.daemon";
import type { ClientsPlugin } from "./clients.plugin";
import type { ServicesPlugin } from "./services.plugin";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createDaemonsPlugin = async (
  clientsPlugin: ClientsPlugin,
  servicesPlugin: ServicesPlugin
) => {
  const blockchainEventsDaemon = withTraceSync(
    'portfolio.init.daemons.blockchain_events',
    () => new BlockchainEventsDaemon(
      clientsPlugin.decorator.rabbitMQClient,
      servicesPlugin.decorator.portfolioService
    )
  );

  await withTraceAsync(
    'portfolio.init.daemons.blockchain_events_initialize',
    async () => {
      await blockchainEventsDaemon.initialize();
    }
  );

  await withTraceAsync(
    'portfolio.init.daemons.blockchain_events_start',
    async () => {
      await blockchainEventsDaemon.start();
    }
  );

  const plugin = withTraceSync(
    'portfolio.init.daemons.plugin',
    () => new Elysia({ name: "Daemons" })
      .use(clientsPlugin)
      .use(servicesPlugin)
      .decorate("blockchainEventsDaemon", blockchainEventsDaemon)
      .onStop(
        async ({ decorator }) => {
          if (decorator.blockchainEventsDaemon) {
            await withTraceAsync(
              'portfolio.stop.daemons.blockchain_events',
              async () => {
                await decorator.blockchainEventsDaemon.stop();
              }
            );
          }
        }
      )
  );

  return plugin;
}

export type DaemonsPlugin = Awaited<ReturnType<typeof createDaemonsPlugin>>