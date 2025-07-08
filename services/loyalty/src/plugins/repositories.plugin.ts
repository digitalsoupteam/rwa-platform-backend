import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { FeesRepository } from "../repositories/fees.repository";
import { ReferralRepository } from "../repositories/referral.repository";
import { ReferrerClaimHistoryRepository } from "../repositories/referrerClaimHistory.repository";
import { CONFIG } from "../config";
import { ReferrerWithdrawRepository } from "../repositories/referrerWithdraw.repository";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("feesRepository", {} as FeesRepository)
  .decorate("referralRepository", {} as ReferralRepository)
  .decorate("referrerClaimHistoryRepository", {} as ReferrerClaimHistoryRepository)
  .decorate("referrerWithdrawRepository", {} as ReferrerWithdrawRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      
      decorator.feesRepository = new FeesRepository();
      decorator.referralRepository = new ReferralRepository();
      decorator.referrerClaimHistoryRepository = new ReferrerClaimHistoryRepository();
      decorator.referrerWithdrawRepository = new ReferrerWithdrawRepository();

      logger.info("Connecting to MongoDB", {
        uri: CONFIG.MONGODB.URI,
      });

      await mongoose.connect(CONFIG.MONGODB.URI);

      logger.info("MongoDB connected successfully");
    }
  )
  .onStop(async () => {
    logger.info("Disconnecting from MongoDB");
    await mongoose.disconnect();
    logger.info("MongoDB disconnected successfully");
  });