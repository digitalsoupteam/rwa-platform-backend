import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getQuestionsRequest,
  getQuestionsResponse,
} from "../../models/validation/questions.validation";

export const getQuestionsController = new Elysia()
  .use(ServicesPlugin)
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