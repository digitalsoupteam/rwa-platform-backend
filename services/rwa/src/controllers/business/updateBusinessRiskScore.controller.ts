import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateBusinessRiskScoreRequest,
  updateBusinessRiskScoreResponse,
} from "../../models/validation/business.validation";

export const updateBusinessRiskScoreController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/updateBusinessRiskScore",
    async ({ body, businessService }) => {
      logger.info(
        `POST /updateBusinessRiskScore - Updating risk score for business with ID: ${body.id}`
      );

      return await businessService.updateRiskScore(body.id);
    },
    {
      body: updateBusinessRiskScoreRequest,
      response: updateBusinessRiskScoreResponse,
    }
  );