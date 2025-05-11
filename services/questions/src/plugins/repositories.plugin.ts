import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { TopicRepository } from "../repositories/topic.repository";
import { QuestionRepository } from "../repositories/question.repository";
import { QuestionLikesRepository } from "../repositories/questionLikes.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("topicRepository", {} as TopicRepository)
  .decorate("questionRepository", {} as QuestionRepository)
  .decorate("questionLikesRepository", {} as QuestionLikesRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      
      decorator.topicRepository = new TopicRepository();
      decorator.questionRepository = new QuestionRepository();
      decorator.questionLikesRepository = new QuestionLikesRepository();

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