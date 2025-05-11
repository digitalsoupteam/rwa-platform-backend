import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { SignatureService } from "../services/signature.service";
import { CONFIG } from "../config";
import { ClientsPlugin } from "./clients.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(ClientsPlugin)
  .decorate("signatureService", {} as SignatureService)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing services");

      await new Promise(r => setTimeout(r, 10000))
      
      if (!CONFIG.SIGNER.PRIVATE_KEY) {
        throw new Error("SIGNER_PRIVATE_KEY is not set");
      }

      decorator.signatureService = new SignatureService(
        decorator.signersManagerClient,
        CONFIG.SIGNER.PRIVATE_KEY
      );

      logger.debug("Services initialized successfully");
    }
  );