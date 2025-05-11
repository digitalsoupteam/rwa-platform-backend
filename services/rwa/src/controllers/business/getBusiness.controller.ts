import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getBusinessRequest,
  getBusinessResponse,
} from "../../models/validation/business.validation";

export const getBusinessController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getBusiness",
    async ({ body, businessService }) => {
      logger.info(
        `POST /getBusiness - Getting business with ID: ${body.id}`
      );

      return await businessService.getBusiness(body.id);
    },
    {
      body: getBusinessRequest,
      response: getBusinessResponse,
    }
  );