import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { FileService } from "../services/file.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)
  .decorate("fileService", {} as FileService)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing services");
    decorator.fileService = new FileService(
      decorator.fileRepository,
      decorator.storageClient
    );
  });