import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateQuestionAnswerRequest,
  updateQuestionAnswerResponse,
} from "../../models/validation/questions.validation";

export const updateQuestionAnswerController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdateQuestionAnswerController" })
    .use(servicesPlugin)
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
};