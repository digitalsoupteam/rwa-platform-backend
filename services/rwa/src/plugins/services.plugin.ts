import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BusinessService } from "../services/business.service";
import { PoolService } from "../services/pool.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";
import { CONFIG } from "../config";
import { TokenService } from "../services/token.service";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)
  .decorate("businessService", {} as BusinessService)
  .decorate("poolService", {} as PoolService)
  .decorate("tokenService", {} as TokenService)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing services");
      await new Promise(r => setTimeout(r, 10000));

      
      decorator.businessService = new BusinessService(
        decorator.businessRepository,
        decorator.openRouterClient,
        decorator.signersManagerClient,
        CONFIG.SUPPORTED_NETWORKS
      );
      decorator.poolService = new PoolService(
        decorator.poolRepository,
        decorator.openRouterClient,
        decorator.signersManagerClient,
        decorator.poolEventsClient,
        CONFIG.SUPPORTED_NETWORKS
      );

      decorator.tokenService = new TokenService(
        decorator.poolRepository,
        decorator.businessRepository,
      );
    }
  );