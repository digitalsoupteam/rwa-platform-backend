import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { OpenRouterClient } from "@shared/openrouter/client";
import { CONFIG } from "../config";
import { RwaClient, rwaClient, PortfolioClient, portfolioClient } from "../clients/eden.clients";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("openRouterClient", {} as OpenRouterClient)
  .decorate("rwaClient", {} as RwaClient)
  .decorate("portfolioClient", {} as PortfolioClient)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing clients");

    decorator.rwaClient = rwaClient;
    decorator.portfolioClient = portfolioClient;

    decorator.openRouterClient = new OpenRouterClient(
      CONFIG.OPENROUTER.API_KEY,
      CONFIG.OPENROUTER.BASE_URL
    );
  });
