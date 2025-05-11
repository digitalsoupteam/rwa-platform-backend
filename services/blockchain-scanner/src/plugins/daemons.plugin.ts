import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainScannerDaemon } from "../daemons/blockchainScanner.daemon";
import { CONFIG } from "../config";
import { ServicesPlugin } from "./services.plugin";

export const DaemonsPlugin = new Elysia({ name: "Daemons" })
  .use(ServicesPlugin)
  .decorate("blockchainScanner", {} as BlockchainScannerDaemon)
  .onStart(
    async ({ decorator }) => {
      logger.info("Initializing blockchain scanner");
      decorator.blockchainScanner = new BlockchainScannerDaemon(
        CONFIG.BLOCKCHAIN.RPC_URL,
        CONFIG.BLOCKCHAIN.EVENT_EMITTER_ADDRESS,
        CONFIG.BLOCKCHAIN.BLOCK_CONFIRMATIONS,
        CONFIG.SCANNER.SCAN_INTERVAL,
        CONFIG.SCANNER.BATCH_SIZE,
        CONFIG.BLOCKCHAIN.CHAIN_ID,
        decorator.blockchainScannerService
      );
      await decorator.blockchainScanner.initialize();
      await decorator.blockchainScanner.start();
      logger.info("Blockchain scanner started successfully");
    }
  )
  .onStop(async ({ decorator: { blockchainScanner } }) => {
    logger.info("Stopping blockchain scanner");
    await blockchainScanner.stop();
    logger.info("Blockchain scanner stopped successfully");
  });
