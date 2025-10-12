import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { LoyaltyService } from "../services/loyalty.service";
import type { RepositoriesPlugin } from "./repositories.plugin";
import type { ClientsPlugin } from "./clients.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin,
  referralRewardPercentage: number,
  supportedNetworks: any[]
) => {
  const loyaltyService = withTraceSync(
    'loyalty.init.services.loyalty',
    () => new LoyaltyService(
      repositoriesPlugin.decorator.feesRepository,
      repositoriesPlugin.decorator.referralRepository,
      repositoriesPlugin.decorator.referrerWithdrawRepository,
      repositoriesPlugin.decorator.referrerClaimHistoryRepository,
      repositoriesPlugin.decorator.commissionHistoryRepository,
      referralRewardPercentage,
      clientsPlugin.decorator.signersManagerClient,
      supportedNetworks
    )
  );

  const plugin = withTraceSync(
    'loyalty.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate("loyaltyService", loyaltyService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>