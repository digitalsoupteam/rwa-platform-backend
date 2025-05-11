import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteQuestionRequest,
  deleteQuestionResponse,
} from "../../models/validation/questions.validation";

export const deleteQuestionController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/deleteQuestion",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /deleteQuestion - Deleting question with ID: ${body.id}`
      );

      return await questionsService.deleteQuestion(body.id);
    },
    {
      body: deleteQuestionRequest,
      response: deleteQuestionResponse,
    }
  );