import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { OpenRouterClient } from "@shared/openrouter/client";
import { CONFIG } from "../config";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("openRouterClient", {} as OpenRouterClient)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing clients");

    decorator.openRouterClient = new OpenRouterClient(
      CONFIG.OPENROUTER.API_KEY,
      CONFIG.OPENROUTER.BASE_URL
    );
  });
