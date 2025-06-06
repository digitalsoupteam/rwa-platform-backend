import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { getProductOwnerMetricsController } from "../controllers/metrics/getProductOwnerMetrics.controller";
import { getProductOwnerTokenMetricsController } from "../controllers/metrics/getProductOwnerTokenMetrics.controller";
import { getUserPoolActivitiesController } from "../controllers/metrics/getUserPoolActivities.controller";
import { getUserPoolTokenActivitiesController } from "../controllers/metrics/getUserPoolTokenActivities.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(getProductOwnerMetricsController)
  .use(getProductOwnerTokenMetricsController)
  .use(getUserPoolActivitiesController)
  .use(getUserPoolTokenActivitiesController);