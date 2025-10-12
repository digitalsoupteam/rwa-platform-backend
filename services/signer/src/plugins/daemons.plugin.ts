import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { SignatureDaemon } from "../daemons/signature.daemon";
import { ServicesPlugin } from "./services.plugin";
import { withTraceAsync, withTraceSync } from "@shared/monitoring/src/tracing";

export const createDaemonsPlugin = async (servicesPlugin: ServicesPlugin) => {
  const signatureDaemon = withTraceSync(
    'signer.init.daemons.signature',
    () => new SignatureDaemon(
      servicesPlugin.decorator.signersManagerClient,
      servicesPlugin.decorator.signatureService,
    )
  );

  await withTraceAsync(
    'signer.init.daemons.initialize',
    async () => {
      logger.info("Initializing signature daemon");
      await signatureDaemon.initialize();
      await signatureDaemon.start();
      logger.info("Signature daemon started successfully");
    }
  );

  const plugin = withTraceSync(
    'signer.init.daemons.plugin',
    () => new Elysia({ name: "Daemons" })
      .use(servicesPlugin)
      .decorate("signatureDaemon", signatureDaemon)
      .onStop(async () => {
        await withTraceAsync(
          'signer.stop.daemons',
          async () => {
            logger.info("Stopping signature daemon");
            await signatureDaemon.stop();
            logger.info("Signature daemon stopped successfully");
          }
        );
      })
  );

  return plugin;
}

export type DaemonsPlugin = Awaited<ReturnType<typeof createDaemonsPlugin>>