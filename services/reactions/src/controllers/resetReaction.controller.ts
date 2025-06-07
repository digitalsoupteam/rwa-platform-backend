import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  resetReactionRequest,
  resetReactionResponse,
} from "../models/validation/reactions.validation";

export const resetReactionController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/resetReaction",
    async ({ body, reactionsService }) => {
      logger.info(
        `POST /resetReaction - Resetting reaction for parent: ${body.parentId} by user: ${body.userId}`
      );

      return reactionsService.resetReaction(body);
    },
    {
      body: resetReactionRequest,
      response: resetReactionResponse,
    }
  );