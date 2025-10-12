import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateTopicRequest,
  updateTopicResponse,
} from "../../models/validation/faq.validation";

export const updateTopicController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdateTopicController" })
    .use(servicesPlugin)
    .post(
      "/updateTopic",
      async ({ body, faqService }) => {
        logger.info(
          `POST /updateTopic - Updating topic with ID: ${body.id}`
        );

        return await faqService.updateTopic(body);
      },
      {
        body: updateTopicRequest,
        response: updateTopicResponse,
      }
    );
};