import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getReactionsRequest,
  getReactionsResponse,
} from "../models/validation/reactions.validation";

export const getReactionsController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getReactions",
    async ({ body, reactionsService }) => {
      logger.info(
        `POST /getReactions - Getting reactions with filter: ${JSON.stringify(body.filter)}`
      );

      return reactionsService.getReactions(body);
    },
    {
      body: getReactionsRequest,
      response: getReactionsResponse,
    }
  );