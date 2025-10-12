import { Elysia } from "elysia";
import mongoose from "mongoose";
import { TokenBalanceRepository } from "../repositories/tokenBalance.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const tokenBalanceRepository = withTraceSync(
    'portfolio.init.repositories.tokenBalance',
    () => new TokenBalanceRepository()
  );

  const transactionRepository = withTraceSync(
    'portfolio.init.repositories.transaction',
    () => new TransactionRepository()
  );

  await withTraceAsync(
    'portfolio.init.repositories_plugin.mongoose',
    async (ctx) => {
      mongoose.connection.once('connected', () => {
        console.log('portfolio mongoose connected')
        ctx.end();
      })
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'portfolio.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("tokenBalanceRepository", tokenBalanceRepository)
      .decorate("transactionRepository", transactionRepository)
      .onStop(async () => {
        await withTraceAsync(
          'portfolio.stop.repositories_plugin',
          async () => {
            await mongoose.disconnect();
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>