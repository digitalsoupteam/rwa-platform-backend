import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createQuestionRequest,
  createQuestionResponse,
} from "../../models/validation/questions.validation";

export const createQuestionController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createQuestion",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /createQuestion - Creating question: ${body.text}`
      );

      return await questionsService.createQuestion(body);
    },
    {
      body: createQuestionRequest,
      response: createQuestionResponse,
    }
  );