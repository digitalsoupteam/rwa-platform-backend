import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainClient } from "../clients/blockchain.client";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createClientsPlugin = async (
  providerUrl: string,
  walletPrivateKey: string
) => {
  const blockchainClient = withTraceSync(
    'testnet-faucet.init.clients.blockchain',
    () => new BlockchainClient(providerUrl, walletPrivateKey)
  );

  await withTraceAsync(
    'testnet-faucet.init.clients.blockchain_initialize',
    async () => {
      logger.info("Initializing blockchain client");
      await blockchainClient.initialize();
      logger.info("Blockchain client initialized successfully");
    }
  );

  const plugin = withTraceSync(
    'testnet-faucet.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("blockchainClient", blockchainClient)
      .onStop(async () => {
        await withTraceAsync(
          'testnet-faucet.stop.clients',
          async () => {
            logger.info("Shutting down blockchain client");
            await blockchainClient.shutdown();
            logger.info("Blockchain client shut down successfully");
          }
        );
      })
  );

  return plugin;
}

export type ClientsPlugin = Awaited<ReturnType<typeof createClientsPlugin>>
