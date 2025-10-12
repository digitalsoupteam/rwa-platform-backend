import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createQuestionAnswerRequest,
  createQuestionAnswerResponse,
} from "../../models/validation/questions.validation";

export const createQuestionAnswerController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "CreateQuestionAnswerController" })
    .use(servicesPlugin)
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
};