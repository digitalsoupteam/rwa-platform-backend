import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getPoolRequest,
  getPoolResponse,
} from "../../models/validation/pool.validation";

export const getPoolController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getPool",
    async ({ body, poolService }) => {
      logger.info(
        `POST /getPool - Getting pool with ID: ${body.id}`
      );

      return await poolService.getPool(body.id);
    },
    {
      body: getPoolRequest,
      response: getPoolResponse,
    }
  );