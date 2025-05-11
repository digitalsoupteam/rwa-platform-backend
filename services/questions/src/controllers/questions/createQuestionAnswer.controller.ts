import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createQuestionAnswerRequest,
  createQuestionAnswerResponse,
} from "../../models/validation/questions.validation";

export const createQuestionAnswerController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createQuestionAnswer",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /createQuestionAnswer - Creating answer for question with ID: ${body.id}`
      );

      return await questionsService.createAnswer(body);
    },
    {
      body: createQuestionAnswerRequest,
      response: createQuestionAnswerResponse,
    }
  );