import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  setReactionRequest,
  setReactionResponse,
} from "../models/validation/reactions.validation";

export const setReactionController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/setReaction",
    async ({ body, reactionsService }) => {
      logger.info(
        `POST /setReaction - Setting reaction for parent: ${body.parentId} by user: ${body.userId}`
      );

      return reactionsService.setReaction(body);
    },
    {
      body: setReactionRequest,
      response: setReactionResponse,
    }
  );