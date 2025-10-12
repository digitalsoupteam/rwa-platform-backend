import { Elysia } from "elysia";
import { ReactionsService } from "../services/reactions.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin
) => {
  const reactionsService = withTraceSync(
    'reactions.init.services.reactions',
    () => new ReactionsService(
      repositoriesPlugin.decorator.reactionRepository
    )
  );

  const plugin = withTraceSync(
    'reactions.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .decorate("reactionsService", reactionsService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>