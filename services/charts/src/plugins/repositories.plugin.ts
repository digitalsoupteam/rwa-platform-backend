import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { PriceDataRepository } from "../repositories/priceData.repository";
import { PoolTransactionRepository } from "../repositories/poolTransaction.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("priceDataRepository", {} as PriceDataRepository)
  .decorate("poolTransactionRepository", {} as PoolTransactionRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      decorator.priceDataRepository = new PriceDataRepository();
      decorator.poolTransactionRepository = new PoolTransactionRepository();

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