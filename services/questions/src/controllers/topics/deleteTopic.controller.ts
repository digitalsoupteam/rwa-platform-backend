import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteTopicRequest,
  deleteTopicResponse,
} from "../../models/validation/questions.validation";

export const deleteTopicController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/deleteTopic",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /deleteTopic - Deleting topic with ID: ${body.id}`
      );

      return await questionsService.deleteTopic(body.id);
    },
    {
      body: deleteTopicRequest,
      response: deleteTopicResponse,
    }
  );