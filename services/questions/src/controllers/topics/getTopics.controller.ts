import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getTopicsRequest,
  getTopicsResponse,
} from "../../models/validation/questions.validation";

export const getTopicsController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetTopicsController" })
    .use(servicesPlugin)
    .post(
      "/getTopics",
      async ({ body, questionsService }) => {
        logger.info(
          `POST /getTopics - Getting  topics`
        );

        return await questionsService.getTopics(body);
      },
      {
        body: getTopicsRequest,
        response: getTopicsResponse,
      }
    );
};