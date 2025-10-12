import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getPoolRequest,
  getPoolResponse,
} from "../../models/validation/pool.validation";

export const getPoolController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetPoolController" })
    .use(servicesPlugin)
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
};