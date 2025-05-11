import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ClientsPlugin } from "./clients.plugin";
import { SignaturesService } from "../services/signatures.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)
  .decorate("signaturesService", {} as SignaturesService)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing services");

      await new Promise(r => setTimeout(r, 10000))
      
      decorator.signaturesService = new SignaturesService(
        decorator.signatureRepository,
        decorator.signatureTaskRepository,
        decorator.signerClient
      );
    }
  );