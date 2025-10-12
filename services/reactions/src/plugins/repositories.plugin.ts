import { Elysia } from "elysia";
import mongoose from "mongoose";
import { ReactionRepository } from "../repositories/reaction.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const reactionRepository = withTraceSync(
    'reactions.init.repositories.reaction',
    () => new ReactionRepository()
  );

  await withTraceAsync(
    'reactions.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('reactions mongoose connected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'reactions.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("reactionRepository", reactionRepository)
      .onStop(async () => {
        await withTraceAsync(
          'reactions.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>