import { Elysia } from "elysia";
import { StorageClient } from "../clients/storage.client";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createClientsPlugin = (rootDir: string) => {
  const storageClient = withTraceSync(
    'files.init.clients.storage',
    () => new StorageClient(rootDir)
  );

  const plugin = withTraceSync(
    'files.init.clients.plugin',
    () => new Elysia({ name: "Clients" })
      .decorate("storageClient", storageClient)
  );

  return plugin;
}

export type ClientsPlugin = ReturnType<typeof createClientsPlugin>