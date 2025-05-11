import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainClient } from "../clients/blockchain.client";
import { CONFIG } from "../config";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("blockchainClient", {} as BlockchainClient)

  .onStart(async ({ decorator }) => {
    logger.info("Initializing blockchain client");
    decorator.blockchainClient = new BlockchainClient(
      CONFIG.BLOCKCHAIN.PROVIDER_URL,
      CONFIG.BLOCKCHAIN.WALLET_PRIVATE_KEY
    );
    await decorator.blockchainClient.initialize();
    logger.info("Blockchain client initialized successfully");
  })

  .onStop(async ({ decorator }) => {
    logger.info("Shutting down blockchain client");
    await decorator.blockchainClient.shutdown();
    logger.info("Blockchain client shut down successfully");
  });
