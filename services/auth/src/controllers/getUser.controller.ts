import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import {
  getUserRequest,
  getUserResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const getUserController = new Elysia().use(ServicesPlugin).post(
  "/getUser",
  async ({ body, authService }) => {
    logger.info(
      `POST /getUser - Getting user by ID: ${body.userId}`
    );
    return authService.getUser(body.userId);
  },
  {
    body: getUserRequest,
    response: getUserResponse,
  }
);