import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ChartsService } from "../services/charts.service";
import { TransactionsService } from "../services/transactions.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin
) => {
  const chartsService = withTraceSync(
    'charts.init.services.charts',
    () => new ChartsService(
      repositoriesPlugin.decorator.priceDataRepository,
      clientsPlugin.decorator.chartEventsClient
    )
  );

  const transactionsService = withTraceSync(
    'charts.init.services.transactions',
    () => new TransactionsService(
      repositoriesPlugin.decorator.poolTransactionRepository,
      clientsPlugin.decorator.chartEventsClient
    )
  );

  const plugin = withTraceSync(
    'charts.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate("chartsService", chartsService)
      .decorate("transactionsService", transactionsService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>