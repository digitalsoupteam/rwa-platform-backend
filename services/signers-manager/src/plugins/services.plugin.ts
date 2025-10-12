import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ClientsPlugin } from "./clients.plugin";
import { SignaturesService } from "../services/signatures.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin
) => {
  const signaturesService = withTraceSync(
    'signers-manager.init.services.signatures',
    () => new SignaturesService(
      repositoriesPlugin.decorator.signatureRepository,
      repositoriesPlugin.decorator.signatureTaskRepository,
      clientsPlugin.decorator.signerClient
    )
  );

  const plugin = withTraceSync(
    'signers-manager.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate("signaturesService", signaturesService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>