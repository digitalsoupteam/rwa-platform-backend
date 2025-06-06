import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getUserPoolTokenActivitiesRequest,
  getUserPoolTokenActivitiesResponse,
} from "../../models/validation/metrics.validation";

export const getUserPoolTokenActivitiesController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getUserPoolTokenActivities",
    async ({ body, metricsService }) => {
      logger.info(
        `POST /getUserPoolTokenActivities - Getting user pool token activities`
      );
      
      return await metricsService.getUserPoolTokenActivities(body);
    },
    {
      body: getUserPoolTokenActivitiesRequest,
      response: getUserPoolTokenActivitiesResponse,
    }
  );