import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getQuestionRequest,
  getQuestionResponse,
} from "../../models/validation/questions.validation";

export const getQuestionController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getQuestion",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /getQuestion - Getting question with ID: ${body.id}`
      );

      return await questionsService.getQuestion(body.id);
    },
    {
      body: getQuestionRequest,
      response: getQuestionResponse,
    }
  );