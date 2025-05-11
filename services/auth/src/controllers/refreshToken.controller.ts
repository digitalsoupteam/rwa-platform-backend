import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  refreshTokenRequest,
  refreshTokenResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const refreshTokenController = new Elysia().use(ServicesPlugin).post(
  "/refreshToken",
  async ({ body, authService }) => {
    logger.info(
      `POST /refreshToken - Refreshing token`
    );

    const tokens = await authService.refreshToken({
      refreshToken: body.refreshToken,
    });

    return tokens;
  },
  {
    body: refreshTokenRequest,
    response: refreshTokenResponse,
  }
);