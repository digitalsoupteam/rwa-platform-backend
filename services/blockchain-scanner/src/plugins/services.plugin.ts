import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainScannerService } from "../services/blockchainScanner.service";
import { CONFIG } from "../config";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)
  .decorate("blockchainScannerService", {} as BlockchainScannerService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.blockchainScannerService = new BlockchainScannerService(
        decorator.eventRepository,
        decorator.scannerStateRepository,
        decorator.rabbitMQClient,
        CONFIG.BLOCKCHAIN.CHAIN_ID
      );
    }
  );
