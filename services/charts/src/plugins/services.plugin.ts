import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ChartsService } from "../services/charts.service";
import { TransactionsService } from "../services/transactions.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)
  .decorate("chartsService", {} as ChartsService)
  .decorate("transactionsService", {} as TransactionsService)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing services");
      
      decorator.chartsService = new ChartsService(
        decorator.priceDataRepository,
        decorator.chartEventsClient
      );

      decorator.transactionsService = new TransactionsService(
        decorator.poolTransactionRepository,
        decorator.chartEventsClient
      );
    }
  );