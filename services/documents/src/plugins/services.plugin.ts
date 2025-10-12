import { Elysia } from "elysia";
import { DocumentsService } from "../services/documents.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin
) => {
  const documentsService = withTraceSync(
    'documents.init.services.documents',
    () => new DocumentsService(
      repositoriesPlugin.decorator.documentsFolderRepository,
      repositoriesPlugin.decorator.documentRepository
    )
  );

  const plugin = withTraceSync(
    'documents.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .decorate("documentsService", documentsService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>