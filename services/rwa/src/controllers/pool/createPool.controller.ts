import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createPoolRequest,
  createPoolResponse,
} from "../../models/validation/pool.validation";

export const createPoolController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createPool",
    async ({ body, poolService }) => {
      logger.info(
        `POST /createPool - Creating pool with name: ${body.name}`
      );

      return await poolService.createPool(body);
    },
    {
      body: createPoolRequest,
      response: createPoolResponse,
    }
  );