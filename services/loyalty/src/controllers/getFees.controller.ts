import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getFeesRequest,
  getFeesResponse,
} from "../models/validation/loyalty.validation";

export const getFeesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetFeesController" })
    .use(servicesPlugin)
    .post(
      "/getFees",
      async ({ body, loyaltyService }) => {
        logger.info(
          `POST /getFees - Getting fees`
        );

        return await loyaltyService.getFees(body);
      },
      {
        body: getFeesRequest,
        response: getFeesResponse,
      }
    );
};