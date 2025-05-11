import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { StorageClient } from "../clients/storage.client";

export const ClientsPlugin = new Elysia({ name: "Clients" })
  .decorate("storageClient", {} as StorageClient)
  .onStart(async ({ decorator }) => {
    logger.debug("Initializing clients");
    decorator.storageClient = new StorageClient();
  });