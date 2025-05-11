import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { TokenBalanceRepository } from "../repositories/tokenBalance.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("tokenBalanceRepository", {} as TokenBalanceRepository)
  .decorate("transactionRepository", {} as TransactionRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      
      decorator.tokenBalanceRepository = new TokenBalanceRepository();
      decorator.transactionRepository = new TransactionRepository();

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