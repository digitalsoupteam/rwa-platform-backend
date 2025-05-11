import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { BusinessRepository } from "../repositories/business.repository";
import { PoolRepository } from "../repositories/pool.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("businessRepository", {} as BusinessRepository)
  .decorate("poolRepository", {} as PoolRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      decorator.businessRepository = new BusinessRepository();
      decorator.poolRepository = new PoolRepository();

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