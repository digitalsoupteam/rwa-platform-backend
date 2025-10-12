import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainScannerDaemon } from "../daemons/blockchainScanner.daemon";
import type { ServicesPlugin } from "./services.plugin";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createDaemonsPlugin = async (
  servicesPlugin: ServicesPlugin,
  rpcUrl: string,
  contractAddress: string,
  blockConfirmations: number,
  scanIntervalMs: number,
  batchSize: number,
  chainId: number
) => {
  const blockchainScanner = withTraceSync(
    'blockchain-scanner.init.daemons.blockchain_scanner',
    () => new BlockchainScannerDaemon(
      rpcUrl,
      contractAddress,
      blockConfirmations,
      scanIntervalMs,
      batchSize,
      chainId,
      servicesPlugin.decorator.blockchainScannerService
    )
  );

  await withTraceAsync(
    'blockchain-scanner.init.daemons.initialize',
    async () => {
      logger.info("Initializing blockchain scanner");
      await blockchainScanner.initialize();
      await blockchainScanner.start();
      logger.info("Blockchain scanner started successfully");
    }
  );

  const plugin = withTraceSync(
    'blockchain-scanner.init.daemons.plugin',
    () => new Elysia({ name: "Daemons" })
      .use(servicesPlugin)
      .decorate("blockchainScanner", blockchainScanner)
      .onStop(async () => {
        await withTraceAsync(
          'blockchain-scanner.stop.daemons',
          async () => {
            logger.info("Stopping blockchain scanner");
            await blockchainScanner.stop();
            logger.info("Blockchain scanner stopped successfully");
          }
        );
      })
  );

  return plugin;
}

export type DaemonsPlugin = Awaited<ReturnType<typeof createDaemonsPlugin>>
