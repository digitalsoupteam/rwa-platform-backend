import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getTopicRequest,
  getTopicResponse,
} from "../../models/validation/faq.validation";

export const getTopicController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getTopic",
    async ({ body, faqService }) => {
      logger.info(
        `POST /getTopic - Getting topic with ID: ${body.id}`
      );

      return await faqService.getTopic(body.id);
    },
    {
      body: getTopicRequest,
      response: getTopicResponse,
    }
  );