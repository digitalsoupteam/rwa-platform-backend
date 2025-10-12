import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getQuestionsRequest,
  getQuestionsResponse,
} from "../../models/validation/questions.validation";

export const getQuestionsController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetQuestionsController" })
    .use(servicesPlugin)
    .post(
      "/getQuestions",
      async ({ body, questionsService }) => {
        logger.info(
          `POST /getQuestions - Getting questions for topics`
        );

        return await questionsService.getQuestions(body);
      },
      {
        body: getQuestionsRequest,
        response: getQuestionsResponse,
      }
    );
};