import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateTopicRequest,
  updateTopicResponse,
} from "../../models/validation/questions.validation";

export const updateTopicController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/updateTopic",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /updateTopic - Updating topic with ID: ${body.id}`
      );

      return await questionsService.updateTopic(body);
    },
    {
      body: updateTopicRequest,
      response: updateTopicResponse,
    }
  );