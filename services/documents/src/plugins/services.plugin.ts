import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { DocumentsService } from "../services/documents.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("documentsService", {} as DocumentsService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.documentsService = new DocumentsService(
        decorator.documentsFolderRepository,
        decorator.documentRepository
      );
    }
  );