import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteTopicRequest,
  deleteTopicResponse,
} from "../../models/validation/faq.validation";

export const deleteTopicController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/deleteTopic",
    async ({ body, faqService }) => {
      logger.info(
        `POST /deleteTopic - Deleting topic with ID: ${body.id}`
      );

      return await faqService.deleteTopic(body.id);
    },
    {
      body: deleteTopicRequest,
      response: deleteTopicResponse,
    }
  );