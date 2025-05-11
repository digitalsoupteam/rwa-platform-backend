import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { AssistantRepository } from "../repositories/assistant.repository";
import { MessageRepository } from "../repositories/message.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("assistantRepository", {} as AssistantRepository)
  .decorate("messageRepository", {} as MessageRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      decorator.assistantRepository = new AssistantRepository();
      decorator.messageRepository = new MessageRepository();

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
