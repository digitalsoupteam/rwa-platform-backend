import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ReactionsService } from "../services/reactions.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("reactionsService", {} as ReactionsService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.reactionsService = new ReactionsService(
        decorator.reactionRepository
      );
    }
  );