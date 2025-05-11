import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { FileRepository } from "../repositories/file.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("fileRepository", {} as FileRepository)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing repositories");
    decorator.fileRepository = new FileRepository();

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