import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getTopicsRequest,
  getTopicsResponse,
} from "../../models/validation/questions.validation";

export const getTopicsController = new Elysia()
  .use(ServicesPlugin)
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