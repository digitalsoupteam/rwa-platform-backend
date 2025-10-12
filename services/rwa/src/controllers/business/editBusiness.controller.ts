import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  editBusinessRequest,
  editBusinessResponse,
} from "../../models/validation/business.validation";

export const editBusinessController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "EditBusinessController" })
    .use(servicesPlugin)
    .post(
      "/editBusiness",
      async ({ body, businessService }) => {
        logger.info(
          `POST /editBusiness - Updating business with ID: ${body.id}`
        );

        return await businessService.editBusiness(body);
      },
      {
        body: editBusinessRequest,
        response: editBusinessResponse,
      }
    );
};