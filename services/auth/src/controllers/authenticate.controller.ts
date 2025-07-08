import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  authenticateRequest,
  authenticateResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const authenticateController = new Elysia().use(ServicesPlugin).post(
  "/authenticate",
  async ({ body, authService }) => {
    logger.info(
      `POST /authenticate - Authenticating user with wallet: ${body.wallet}`
    );

    return authService.authenticate(body);
  },
  {
    body: authenticateRequest,
    response: authenticateResponse,
  }
);
