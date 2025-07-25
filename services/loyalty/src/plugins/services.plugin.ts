import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { LoyaltyService } from "../services/loyalty.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";
import { CONFIG } from "../config";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)
  .decorate("loyaltyService", {} as LoyaltyService)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing services");
      await new Promise(r => setTimeout(r, 1000));

      decorator.loyaltyService = new LoyaltyService(
        decorator.feesRepository,
        decorator.referralRepository,
        decorator.referrerWithdrawRepository,
        decorator.referrerClaimHistoryRepository,
        CONFIG.LOYALTY.REFERRAL_REWARD_PERCENTAGE,
        decorator.signersManagerClient,
        CONFIG.SUPPORTED_NETWORKS
      );

      logger.info("Loyalty service initialized");
    }
  );