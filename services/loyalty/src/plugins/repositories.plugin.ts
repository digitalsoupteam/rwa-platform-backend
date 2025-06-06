import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { ProductOwnerMetricsRepository } from "../repositories/productOwnerMetrics.repository";
import { ProductOwnerTokenMetricsRepository } from "../repositories/productOwnerTokenMetrics.repository";
import { UserPoolActivityRepository } from "../repositories/userPoolActivity.repository";
import { UserPoolTokenActivityRepository } from "../repositories/userPoolTokenActivity.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("productOwnerMetricsRepository", {} as ProductOwnerMetricsRepository)
  .decorate("productOwnerTokenMetricsRepository", {} as ProductOwnerTokenMetricsRepository)
  .decorate("userPoolActivityRepository", {} as UserPoolActivityRepository)
  .decorate("userPoolTokenActivityRepository", {} as UserPoolTokenActivityRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      
      decorator.productOwnerMetricsRepository = new ProductOwnerMetricsRepository();
      decorator.productOwnerTokenMetricsRepository = new ProductOwnerTokenMetricsRepository();
      decorator.userPoolActivityRepository = new UserPoolActivityRepository();
      decorator.userPoolTokenActivityRepository = new UserPoolTokenActivityRepository();

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