import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createTopicRequest,
  createTopicResponse,
} from "../../models/validation/questions.validation";

export const createTopicController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "CreateTopicController" })
    .use(servicesPlugin)
    .post(
      "/createTopic",
      async ({ body, questionsService }) => {
        logger.info(
          `POST /createTopic - Creating topic with name: ${body.name}`
        );

        return await questionsService.createTopic(body);
      },
      {
        body: createTopicRequest,
        response: createTopicResponse,
      }
    );
};