import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createBusinessWithAIRequest,
  createBusinessWithAIResponse,
} from "../../models/validation/business.validation";

export const createBusinessWithAIController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "CreateBusinessWithAIController" })
    .use(servicesPlugin)
    .post(
      "/createBusinessWithAI",
      async ({ body, businessService }) => {
        logger.info(
          `POST /createBusinessWithAI - Creating business from description`
        );

        return await businessService.createBusinessWithAI(body);
      },
      {
        body: createBusinessWithAIRequest,
        response: createBusinessWithAIResponse,
      }
    );
};