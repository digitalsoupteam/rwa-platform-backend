import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getTopicRequest,
  getTopicResponse,
} from "../../models/validation/questions.validation";

export const getTopicController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getTopic",
    async ({ body, questionsService }) => {
      logger.info(
        `POST /getTopic - Getting topic with ID: ${body.id}`
      );

      return await questionsService.getTopic(body.id);
    },
    {
      body: getTopicRequest,
      response: getTopicResponse,
    }
  );