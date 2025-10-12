import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteQuestionRequest,
  deleteQuestionResponse,
} from "../../models/validation/questions.validation";

export const deleteQuestionController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "DeleteQuestionController" })
    .use(servicesPlugin)
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
};