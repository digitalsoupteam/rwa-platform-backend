import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createBusinessRequest,
  createBusinessResponse,
} from "../../models/validation/business.validation";

export const createBusinessController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createBusiness",
    async ({ body, businessService }) => {
      logger.info(
        `POST /createBusiness - Creating business with name: ${body.name}`
      );

      return await businessService.createBusiness(body);
    },
    {
      body: createBusinessRequest,
      response: createBusinessResponse,
    }
  );