import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  getUserTokensRequest,
  getUserTokensResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const getUserTokensController = new Elysia().use(ServicesPlugin).post(
  "/getUserTokens",
  async ({ body, authService }) => {
    logger.info(
      `POST /getUserTokens - Getting tokens for user: ${body.userId}`
    );

    return authService.getUserTokens(body.userId);
  },
  {
    body: getUserTokensRequest,
    response: getUserTokensResponse,
  }
);