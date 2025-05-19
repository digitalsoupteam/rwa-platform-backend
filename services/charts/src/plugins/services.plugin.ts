import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ChartsService } from "../services/charts.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("chartsService", {} as ChartsService)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing services");
      
      decorator.chartsService = new ChartsService(
        decorator.priceDataRepository
      );
    }
  );