import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  editPoolRequest,
  editPoolResponse,
} from "../../models/validation/pool.validation";

export const editPoolController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "EditPoolController" })
    .use(servicesPlugin)
    .post(
      "/editPool",
      async ({ body, poolService }) => {
        logger.info(
          `POST /editPool - Updating pool with ID: ${body.id}`
        );

        return await poolService.editPool(body);
      },
      {
        body: editPoolRequest,
        response: editPoolResponse,
      }
    );
};