import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ClientsPlugin } from "./clients.plugin";
import { ServicesPlugin } from "./services.plugin";
import { TaskResponsesDaemon } from "../daemons/taskResponses.daemon";

export const DaemonsPlugin = new Elysia({ name: "Daemons" })
  .use(ClientsPlugin)
  .use(ServicesPlugin)
  .decorate("taskResponsesDaemon", {} as TaskResponsesDaemon)
  .onStart(
    async ({ decorator }) => {
      await new Promise(r => setTimeout(r, 10000));
      logger.debug("Initializing daemons");

      decorator.taskResponsesDaemon = new TaskResponsesDaemon(
        decorator.signerClient,
        decorator.signaturesService
      );

      await decorator.taskResponsesDaemon.initialize();
      logger.info("Task responses daemon started successfully");
    }
  );