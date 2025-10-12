import { Elysia } from "elysia";
import mongoose from "mongoose";
import { UserRepository } from "../repositories/user.repository";
import { RefreshTokenRepository } from "../repositories/refreshToken.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";


export const createRepositoriesPlugin = async (mongoUri: string) => {
  const userRepository = withTraceSync(
    'auth.init.repositories.user',
    () => new UserRepository()
  );

  const refreshTokenRepository = withTraceSync(
    'auth.init.repositories.refresh_token',
    () => new RefreshTokenRepository()
  );

  await withTraceAsync(
    'auth.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('aw1 mongoose cpnnected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'auth.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("userRepository", userRepository)
      .decorate("refreshTokenRepository", refreshTokenRepository)
      .onStop(async () => {
        await withTraceAsync(
          'auth.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>