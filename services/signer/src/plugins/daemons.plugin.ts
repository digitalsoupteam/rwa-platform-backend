import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { SignatureDaemon } from "../daemons/signature.daemon";
import { CONFIG } from "../config";
import { ServicesPlugin } from "./services.plugin";

export const DaemonsPlugin = new Elysia({ name: "Daemons" })
  .use(ServicesPlugin)
  .decorate("signatureDaemon", {} as SignatureDaemon)
  .onStart(
    async ({ decorator }) => {
      await new Promise(r => setTimeout(r, 10000))
      logger.info("Initializing signature daemon");
      
      decorator.signatureDaemon = new SignatureDaemon(
        decorator.signersManagerClient,
        decorator.signatureService,
      );

      await decorator.signatureDaemon.initialize();
      await decorator.signatureDaemon.start();
      
      logger.info("Signature daemon started successfully");
    }
  )
  .onStop(async ({ decorator: { signatureDaemon } }) => {
    logger.info("Stopping signature daemon");
    await signatureDaemon.stop();
    logger.info("Signature daemon stopped successfully");
  });