import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getProductOwnerTokenMetricsRequest,
  getProductOwnerTokenMetricsResponse,
} from "../../models/validation/metrics.validation";

export const getProductOwnerTokenMetricsController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getProductOwnerTokenMetrics",
    async ({ body, metricsService }) => {
      logger.info(
        `POST /getProductOwnerTokenMetrics - Getting product owner token metrics`
      );
      
      return await metricsService.getProductOwnerTokenMetrics(body);
    },
    {
      body: getProductOwnerTokenMetricsRequest,
      response: getProductOwnerTokenMetricsResponse,
    }
  );