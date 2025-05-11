import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getAnswersRequest,
  getAnswersResponse,
} from "../../models/validation/faq.validation";

export const getAnswersController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getAnswers",
    async ({ body, faqService }) => {
      logger.info(
        `POST /getAnswers - Getting answers for topic`
      );

      return await faqService.getAnswers(body);
    },
    {
      body: getAnswersRequest,
      response: getAnswersResponse,
    }
  );