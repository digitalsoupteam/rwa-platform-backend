import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { QuestionsService } from "../services/questions.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("questionsService", {} as QuestionsService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.questionsService = new QuestionsService(
        decorator.topicRepository,
        decorator.questionRepository,
        decorator.questionLikesRepository
      );
    }
  );