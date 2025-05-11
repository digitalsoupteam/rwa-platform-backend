import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { PortfolioService } from "../services/portfolio.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("portfolioService", {} as PortfolioService)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing services");

      decorator.portfolioService = new PortfolioService(
        decorator.tokenBalanceRepository,
        decorator.transactionRepository
      );
    }
  );