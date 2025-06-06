import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getProductOwnerMetricsRequest,
  getProductOwnerMetricsResponse,
} from "../../models/validation/metrics.validation";

export const getProductOwnerMetricsController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getProductOwnerMetrics",
    async ({ body, metricsService }) => {
      logger.info(
        `POST /getProductOwnerMetrics - Getting product owner metrics`
      );
      
      return await metricsService.getProductOwnerMetrics(body);
    },
    {
      body: getProductOwnerMetricsRequest,
      response: getProductOwnerMetricsResponse,
    }
  );