import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BlockchainScannerService } from "../services/blockchainScanner.service";
import type { RepositoriesPlugin } from "./repositories.plugin";
import type { ClientsPlugin } from "./clients.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin,
  chainId: number
) => {
  const blockchainScannerService = withTraceSync(
    'blockchain-scanner.init.services.blockchain_scanner',
    () => new BlockchainScannerService(
      repositoriesPlugin.decorator.eventRepository,
      repositoriesPlugin.decorator.scannerStateRepository,
      clientsPlugin.decorator.rabbitMQClient,
      chainId
    )
  );

  const plugin = withTraceSync(
    'blockchain-scanner.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate("blockchainScannerService", blockchainScannerService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>
