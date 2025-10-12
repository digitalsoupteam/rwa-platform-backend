import { Elysia } from "elysia";
import { FileService } from "../services/file.service";
import type { RepositoriesPlugin } from "./repositories.plugin";
import type { ClientsPlugin } from "./clients.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin
) => {
  const fileService = withTraceSync(
    'files.init.services.file',
    () => new FileService(
      repositoriesPlugin.decorator.fileRepository,
      clientsPlugin.decorator.storageClient
    )
  );

  const plugin = withTraceSync(
    'files.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate("fileService", fileService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>