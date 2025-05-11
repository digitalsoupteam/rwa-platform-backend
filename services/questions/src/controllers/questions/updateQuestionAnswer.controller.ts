import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateQuestionAnswerRequest,
  updateQuestionAnswerResponse,
} from "../../models/validation/questions.validation";

export const updateQuestionAnswerController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/updateQuestionAnswer",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /updateQuestionAnswer - Updating question with ID: ${body.id}`
      );

      return await questionsService.updateAnswer(body);
    },
    {
      body: updateQuestionAnswerRequest,
      response: updateQuestionAnswerResponse,
    }
  );