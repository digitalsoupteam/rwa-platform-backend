import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createQuestionRequest,
  createQuestionResponse,
} from "../../models/validation/questions.validation";

export const createQuestionController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "CreateQuestionController" })
    .use(servicesPlugin)
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
};