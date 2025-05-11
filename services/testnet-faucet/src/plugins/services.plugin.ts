import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { FaucetService } from "../services/faucet.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";
import { CONFIG } from "../config";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)
  .decorate("faucetService", {} as FaucetService)
  .onStart(({ decorator }) => {
    logger.debug("Initializing services");
    decorator.faucetService = new FaucetService(
      decorator.faucetRequestRepository,
      decorator.blockchainClient,
      CONFIG.BLOCKCHAIN.HOLD_TOKEN_ADDRESS,
      CONFIG.FAUCET.GAS_TOKEN_AMOUNT,
      CONFIG.FAUCET.HOLD_TOKEN_AMOUNT,
      CONFIG.FAUCET.REQUEST_GAS_DELAY,
      CONFIG.FAUCET.REQUEST_HOLD_DELAY
    );
  });
