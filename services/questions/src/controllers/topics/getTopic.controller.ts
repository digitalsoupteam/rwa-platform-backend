import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getTopicRequest,
  getTopicResponse,
} from "../../models/validation/questions.validation";

export const getTopicController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetTopicController" })
    .use(servicesPlugin)
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
};