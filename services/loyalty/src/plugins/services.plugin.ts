import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { MetricsService } from "../services/metrics.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("metricsService", {} as MetricsService)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing services");

      decorator.metricsService = new MetricsService(
        decorator.productOwnerMetricsRepository,
        decorator.productOwnerTokenMetricsRepository,
        decorator.userPoolActivityRepository,
        decorator.userPoolTokenActivityRepository
      );
    }
  );