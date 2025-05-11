import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { EventRepository } from "../repositories/event.repository";
import { ScannerStateRepository } from "../repositories/scannerState.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("eventRepository", {} as EventRepository)
  .decorate("scannerStateRepository", {} as ScannerStateRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");

      decorator.eventRepository = new EventRepository();
      decorator.scannerStateRepository = new ScannerStateRepository();

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
