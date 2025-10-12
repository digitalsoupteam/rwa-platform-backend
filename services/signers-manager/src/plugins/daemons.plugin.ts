import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ClientsPlugin } from "./clients.plugin";
import { ServicesPlugin } from "./services.plugin";
import { TaskResponsesDaemon } from "../daemons/taskResponses.daemon";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createDaemonsPlugin = async (
  clientsPlugin: ClientsPlugin,
  servicesPlugin: ServicesPlugin
) => {
  const taskResponsesDaemon = withTraceSync(
    'signers-manager.init.daemons.task_responses',
    () => new TaskResponsesDaemon(
      clientsPlugin.decorator.signerClient,
      servicesPlugin.decorator.signaturesService
    )
  );

  await withTraceAsync(
    'signers-manager.init.daemons.initialize',
    async () => {
      logger.debug("Initializing daemons");
      await taskResponsesDaemon.initialize();
      logger.info("Task responses daemon started successfully");
    }
  );

  const plugin = withTraceSync(
    'signers-manager.init.daemons.plugin',
    () => new Elysia({ name: "Daemons" })
      .use(clientsPlugin)
      .use(servicesPlugin)
      .decorate("taskResponsesDaemon", taskResponsesDaemon)
  );

  return plugin;
}

export type DaemonsPlugin = Awaited<ReturnType<typeof createDaemonsPlugin>>