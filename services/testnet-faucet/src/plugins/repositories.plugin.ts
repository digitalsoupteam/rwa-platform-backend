import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { FaucetRequestRepository } from "../repositories/faucetRequest.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("faucetRequestRepository", {} as FaucetRequestRepository)
  .onStart(async ({ decorator }) => {
    decorator.faucetRequestRepository = new FaucetRequestRepository();
    logger.info("Connecting to MongoDB", {
      uri: CONFIG.MONGODB.URI,
    });

    await mongoose.connect(CONFIG.MONGODB.URI);

    logger.info("MongoDB connected successfully");
  })
  .onStop(async () => {
    logger.info("Disconnecting from MongoDB");
    await mongoose.disconnect();
    logger.info("MongoDB disconnected successfully");
  });
