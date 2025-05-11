import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { UserRepository } from "../repositories/user.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("userRepository", {} as UserRepository)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing repositories");
    decorator.userRepository = new UserRepository();

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
