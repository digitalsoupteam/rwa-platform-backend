import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { FaqService } from "../services/faq.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("faqService", {} as FaqService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.faqService = new FaqService(
        decorator.topicRepository,
        decorator.answerRepository
      );
    }
  );