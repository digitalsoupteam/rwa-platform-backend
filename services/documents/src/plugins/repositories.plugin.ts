import { Elysia } from "elysia";
import mongoose from "mongoose";
import { DocumentsFolderRepository } from "../repositories/documentsFolder.repository";
import { DocumentRepository } from "../repositories/document.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const documentsFolderRepository = withTraceSync(
    'documents.init.repositories.documentsFolder',
    () => new DocumentsFolderRepository()
  );

  const documentRepository = withTraceSync(
    'documents.init.repositories.document',
    () => new DocumentRepository()
  );

  await withTraceAsync(
    'documents.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('documents mongoose connected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'documents.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("documentsFolderRepository", documentsFolderRepository)
      .decorate("documentRepository", documentRepository)
      .onStop(async () => {
        await withTraceAsync(
          'documents.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>