import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { SignatureRepository } from "../repositories/signature.repository";
import { SignatureTaskRepository } from "../repositories/signatureTask.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("signatureRepository", {} as SignatureRepository)
  .decorate("signatureTaskRepository", {} as SignatureTaskRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      decorator.signatureRepository = new SignatureRepository();
      decorator.signatureTaskRepository = new SignatureTaskRepository();

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