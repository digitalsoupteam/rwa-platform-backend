import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  toggleQuestionLikeRequest,
  toggleQuestionLikeResponse,
} from "../../models/validation/questions.validation";

export const toggleQuestionLikeController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/toggleQuestionLike",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /toggleQuestionLike - Toggling like for question: ${body.questionId} by user: ${body.userId}`
      );

      return await questionsService.toggleLike(body);
    },
    {
      body: toggleQuestionLikeRequest,
      response: toggleQuestionLikeResponse,
    }
  );