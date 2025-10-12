import { Elysia } from "elysia";
import { OpenRouterClient } from "@shared/openrouter/client";
import { withTraceSync } from "@shared/monitoring/src/tracing";
import { createPortfolioClient, createRwaClient } from "../clients/eden.clients";

export const createClientsPlugin = (
  openRouterApiKey: string,
  openRouterBaseUrl: string,
  rwaServiceUrl: string,
  portfolioServiceUrl: string,
) => {
  const openRouterClient = withTraceSync(
    'ai-assistant.init.clients.openrouter',
    () => new OpenRouterClient(openRouterApiKey, openRouterBaseUrl)
  );

  const rwaClient = withTraceSync(
    'ai-assistant.init.clients.rwa',
    () => createRwaClient(rwaServiceUrl)
  );

  const portfolioClient = withTraceSync(
    'ai-assistant.init.clients.portfolio',
    () => createPortfolioClient(portfolioServiceUrl)
  );

  const plugin = withTraceSync(
    'ai-assistant.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("openRouterClient", openRouterClient)
      .decorate("rwaClient", rwaClient)
      .decorate("portfolioClient", portfolioClient)
  );

  return plugin;
}

export type ClientsPlugin = ReturnType<typeof createClientsPlugin>
