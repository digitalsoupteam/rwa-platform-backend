import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getEntityReactionsRequest,
  getEntityReactionsResponse,
} from "../models/validation/reactions.validation";

export const getEntityReactionsController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getEntityReactions",
    async ({ body, reactionsService }) => {
      logger.info(
        `POST /getEntityReactions - Getting reactions for parent: ${body.parentId}, type: ${body.parentType}`
      );

      return reactionsService.getEntityReactions(body);
    },
    {
      body: getEntityReactionsRequest,
      response: getEntityReactionsResponse,
    }
  );