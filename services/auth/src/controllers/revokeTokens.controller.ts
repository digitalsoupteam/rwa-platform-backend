import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  revokeTokensRequest,
  revokeTokensResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const revokeTokensController = new Elysia().use(ServicesPlugin).post(
  "/revokeTokens",
  async ({ body, authService }) => {
    logger.info(
      `POST /revokeTokens - Revoking ${body.tokenHashes.length} tokens for user: ${body.userId}`
    );

    return authService.revokeTokens(body.userId, body.tokenHashes);
  },
  {
    body: revokeTokensRequest,
    response: revokeTokensResponse,
  }
);