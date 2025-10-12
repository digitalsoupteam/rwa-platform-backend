import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createAnswerRequest,
  createAnswerResponse,
} from "../../models/validation/faq.validation";

export const createAnswerController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "CreateAnswerController" })
    .use(servicesPlugin)
    .post(
      "/createAnswer",
      async ({ body, faqService }) => {
        logger.info(
          `POST /createAnswer - Creating answer for question: ${body.question}`
        );

        return await faqService.createAnswer(body);
      },
      {
        body: createAnswerRequest,
        response: createAnswerResponse,
      }
    );
};