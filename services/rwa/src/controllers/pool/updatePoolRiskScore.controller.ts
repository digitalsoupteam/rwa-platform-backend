import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updatePoolRiskScoreRequest,
  updatePoolRiskScoreResponse,
} from "../../models/validation/pool.validation";

export const updatePoolRiskScoreController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/updatePoolRiskScore",
    async ({ body, poolService }) => {
      logger.info(
        `POST /updatePoolRiskScore - Updating risk score for pool with ID: ${body.id}`
      );

      return await poolService.updateRiskScore(body.id);
    },
    {
      body: updatePoolRiskScoreRequest,
      response: updatePoolRiskScoreResponse,
    }
  );