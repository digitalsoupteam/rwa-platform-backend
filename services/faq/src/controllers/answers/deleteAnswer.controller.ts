import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteAnswerRequest,
  deleteAnswerResponse,
} from "../../models/validation/faq.validation";

export const deleteAnswerController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "DeleteAnswerController" })
    .use(servicesPlugin)
    .post(
      "/deleteAnswer",
      async ({ body, faqService }) => {
        logger.info(
          `POST /deleteAnswer - Deleting answer with ID: ${body.id}`
        );

        return await faqService.deleteAnswer(body.id);
      },
      {
        body: deleteAnswerRequest,
        response: deleteAnswerResponse,
      }
    );
};