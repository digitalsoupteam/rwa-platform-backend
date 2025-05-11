import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getPoolsRequest,
  getPoolsResponse,
} from "../../models/validation/pool.validation";

export const getPoolsController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getPools",
    async ({ body, poolService }) => {
      logger.info(
        `POST /getPools - Getting pools list`
      );

      return await poolService.getPools(body);
    },
    {
      body: getPoolsRequest,
      response: getPoolsResponse,
    }
  );