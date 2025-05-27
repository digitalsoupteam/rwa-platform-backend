import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  toggleReactionRequest,
  toggleReactionResponse,
} from "../models/validation/reactions.validation";

export const toggleReactionController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/toggleReaction",
    async ({ body, reactionsService }) => {
      logger.info(
        `POST /toggleReaction - Toggling reaction for parent: ${body.parentId} by user: ${body.userId}`
      );

      return await reactionsService.toggle(body);
    },
    {
      body: toggleReactionRequest,
      response: toggleReactionResponse,
    }
  );