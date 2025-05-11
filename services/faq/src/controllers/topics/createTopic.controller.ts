import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createTopicRequest,
  createTopicResponse,
} from "../../models/validation/faq.validation";

export const createTopicController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createTopic",
    async ({ body, faqService }) => {
      logger.info(
        `POST /createTopic - Creating topic with name: ${body.name}`
      );

      return await faqService.createTopic(body);
    },
    {
      body: createTopicRequest,
      response: createTopicResponse,
    }
  );