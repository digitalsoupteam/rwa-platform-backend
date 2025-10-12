import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { BusinessService } from "../services/business.service";
import { PoolService } from "../services/pool.service";
import type { RepositoriesPlugin } from "./repositories.plugin";
import type { ClientsPlugin } from "./clients.plugin";
import { TokenService } from "../services/token.service";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin,
  supportedNetworks: any[]
) => {
  const businessService = withTraceSync(
    'rwa.init.services.business',
    () => new BusinessService(
      repositoriesPlugin.decorator.businessRepository,
      clientsPlugin.decorator.openRouterClient,
      clientsPlugin.decorator.signersManagerClient,
      supportedNetworks
    )
  );

  const poolService = withTraceSync(
    'rwa.init.services.pool',
    () => new PoolService(
      repositoriesPlugin.decorator.poolRepository,
      clientsPlugin.decorator.openRouterClient,
      clientsPlugin.decorator.signersManagerClient,
      clientsPlugin.decorator.poolEventsClient,
      supportedNetworks
    )
  );

  const tokenService = withTraceSync(
    'rwa.init.services.token',
    () => new TokenService(
      repositoriesPlugin.decorator.poolRepository,
      repositoriesPlugin.decorator.businessRepository,
    )
  );

  const plugin = withTraceSync(
    'rwa.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate("businessService", businessService)
      .decorate("poolService", poolService)
      .decorate("tokenService", tokenService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>