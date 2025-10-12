import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getBusinessesRequest,
  getBusinessesResponse,
} from "../../models/validation/business.validation";

export const getBusinessesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetBusinessesController" })
    .use(servicesPlugin)
    .post(
      "/getBusinesses",
      async ({ body, businessService }) => {
        logger.info(
          `POST /getBusinesses - Getting businesses list`
        );

        return await businessService.getBusinesses(body);
      },
      {
        body: getBusinessesRequest,
        response: getBusinessesResponse,
      }
    );
};