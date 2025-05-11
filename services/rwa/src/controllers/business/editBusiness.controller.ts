import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateBusinessRequest,
  updateBusinessResponse,
} from "../../models/validation/business.validation";

export const editBusinessController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/editBusiness",
    async ({ body, businessService }) => {
      logger.info(
        `POST /editBusiness - Updating business with ID: ${body.id}`
      );

      return await businessService.editBusiness(body);
    },
    {
      body: updateBusinessRequest,
      response: updateBusinessResponse,
    }
  );