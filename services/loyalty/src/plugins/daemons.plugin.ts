import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainEventsDaemon } from "../daemons/blockchainEvents.daemon";
import { ClientsPlugin } from "./clients.plugin";
import { ServicesPlugin } from "./services.plugin";

export const DaemonsPlugin = new Elysia({ name: "Daemons" })
  .use(ClientsPlugin)
  .use(ServicesPlugin)
  .decorate("blockchainEventsDaemon", {} as BlockchainEventsDaemon)
  .onStart(
    async ({
      decorator
    }) => {
      await new Promise(r => setTimeout(r, 10000))
      logger.debug("Initializing daemons");

      // Initialize blockchain events daemon
      decorator.blockchainEventsDaemon = new BlockchainEventsDaemon(
        decorator.rabbitMQClient,
        decorator.loyaltyService
      );

      await decorator.blockchainEventsDaemon.initialize();
      await decorator.blockchainEventsDaemon.start();
      
      logger.info("Blockchain events daemon started");
    }
  )
  .onStop(
    async ({
      decorator
    }) => {
      if (decorator.blockchainEventsDaemon) {
        await decorator.blockchainEventsDaemon.stop();
        logger.info("Blockchain events daemon stopped");
      }
    }
  );