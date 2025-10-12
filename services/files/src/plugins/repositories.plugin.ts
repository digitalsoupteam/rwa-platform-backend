import { Elysia } from "elysia";
import mongoose from "mongoose";
import { FileRepository } from "../repositories/file.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const fileRepository = withTraceSync(
    'files.init.repositories.file',
    () => new FileRepository()
  );

  await withTraceAsync(
    'files.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('files mongoose connected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'files.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("fileRepository", fileRepository)
      .onStop(async () => {
        await withTraceAsync(
          'files.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>