import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateQuestionTextRequest,
  updateQuestionTextResponse,
} from "../../models/validation/questions.validation";

export const updateQuestionTextController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/updateQuestionText",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /updateQuestionText - Updating question with ID: ${body.id}`
      );

      return await questionsService.updateQuestionText(body);
    },
    {
      body: updateQuestionTextRequest,
      response: updateQuestionTextResponse,
    }
  );