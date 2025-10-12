import { Elysia } from "elysia";
import { PortfolioService } from "../services/portfolio.service";
import type { RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin
) => {
  const portfolioService = withTraceSync(
    'portfolio.init.services.portfolio',
    () => new PortfolioService(
      repositoriesPlugin.decorator.tokenBalanceRepository,
      repositoriesPlugin.decorator.transactionRepository
    )
  );

  const plugin = withTraceSync(
    'portfolio.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .decorate("portfolioService", portfolioService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>