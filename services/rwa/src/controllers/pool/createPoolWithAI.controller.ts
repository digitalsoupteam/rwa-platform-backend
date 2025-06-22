import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createPoolWithAIRequest,
  createPoolWithAIResponse,
} from "../../models/validation/pool.validation";

export const createPoolWithAIController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createPoolWithAI",
    async ({ body, poolService }) => {
      logger.info(
        `POST /createPoolWithAI - Creating pool from description`
      );

      return await poolService.createPoolWithAI(body);
    },
    {
      body: createPoolWithAIRequest,
      response: createPoolWithAIResponse,
    }
  );