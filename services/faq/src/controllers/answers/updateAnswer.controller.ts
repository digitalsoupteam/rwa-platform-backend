import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateAnswerRequest,
  updateAnswerResponse,
} from "../../models/validation/faq.validation";

export const updateAnswerController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdateAnswerController" })
    .use(servicesPlugin)
    .post(
      "/updateAnswer",
      async ({ body, faqService }) => {
        logger.info(
          `POST /updateAnswer - Updating answer with ID: ${body.id}`
        );

        return await faqService.updateAnswer(body);
      },
      {
        body: updateAnswerRequest,
        response: updateAnswerResponse,
      }
    );
};