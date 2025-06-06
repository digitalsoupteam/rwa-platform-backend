import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getUserPoolActivitiesRequest,
  getUserPoolActivitiesResponse,
} from "../../models/validation/metrics.validation";

export const getUserPoolActivitiesController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getUserPoolActivities",
    async ({ body, metricsService }) => {
      logger.info(
        `POST /getUserPoolActivities - Getting user pool activities`
      );
      
      return await metricsService.getUserPoolActivities(body);
    },
    {
      body: getUserPoolActivitiesRequest,
      response: getUserPoolActivitiesResponse,
    }
  );