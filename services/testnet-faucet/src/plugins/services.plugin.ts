import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { FaucetService } from "../services/faucet.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin,
  holdTokenAddress: string,
  platformTokenAddress: string,
  gasTokenAmount: number,
  holdTokenAmount: number,
  platformTokenAmount: number,
  requestGasDelay: number,
  requestHoldDelay: number,
  requestPlatformDelay: number
) => {
  const faucetService = withTraceSync(
    'testnet-faucet.init.services.faucet',
    () => new FaucetService(
      repositoriesPlugin.decorator.faucetRequestRepository,
      clientsPlugin.decorator.blockchainClient,
      holdTokenAddress,
      platformTokenAddress,
      gasTokenAmount,
      holdTokenAmount,
      platformTokenAmount,
      requestGasDelay,
      requestHoldDelay,
      requestPlatformDelay
    )
  );

  const plugin = withTraceSync(
    'testnet-faucet.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate("faucetService", faucetService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>
