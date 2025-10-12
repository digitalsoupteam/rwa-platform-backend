import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { SignatureService } from "../services/signature.service";
import { ClientsPlugin } from "./clients.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  clientsPlugin: ClientsPlugin,
  privateKey: string
) => {
  const signatureService = withTraceSync(
    'signer.init.services.signature',
    () => new SignatureService(
      clientsPlugin.decorator.signersManagerClient,
      privateKey
    )
  );

  const plugin = withTraceSync(
    'signer.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(clientsPlugin)
      .decorate("signatureService", signatureService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>