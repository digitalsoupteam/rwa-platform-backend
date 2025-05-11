import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getAnswerRequest,
  getAnswerResponse,
} from "../../models/validation/faq.validation";

export const getAnswerController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getAnswer",
    async ({ body, faqService }) => {
      logger.info(
        `POST /getAnswer - Getting answer with ID: ${body.id}`
      );

      return await faqService.getAnswer(body.id);
    },
    {
      body: getAnswerRequest,
      response: getAnswerResponse,
    }
  );