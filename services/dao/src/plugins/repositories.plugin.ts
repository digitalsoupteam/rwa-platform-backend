import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { ProposalRepository } from "../repositories/proposal.repository";
import { VoteRepository } from "../repositories/vote.repository";
import { StakingRepository } from "../repositories/staking.repository";
import { StakingHistoryRepository } from "../repositories/stakingHistory.repository";
import { TimelockTaskRepository } from "../repositories/timelockTask.repository";
import { TreasuryWithdrawRepository } from "../repositories/treasuryWithdraw.repository";
import { withTraceSync, withTraceAsync } from "@shared/monitoring/src/tracing";

export const createRepositoriesPlugin = async (mongoUri: string) => {
  const proposalRepository = withTraceSync(
    'dao.init.repositories.proposal',
    () => new ProposalRepository()
  );

  const voteRepository = withTraceSync(
    'dao.init.repositories.vote',
    () => new VoteRepository()
  );

  const stakingRepository = withTraceSync(
    'dao.init.repositories.staking',
    () => new StakingRepository()
  );

  const stakingHistoryRepository = withTraceSync(
    'dao.init.repositories.staking_history',
    () => new StakingHistoryRepository()
  );

  const timelockTaskRepository = withTraceSync(
    'dao.init.repositories.timelock_task',
    () => new TimelockTaskRepository()
  );

  const treasuryWithdrawRepository = withTraceSync(
    'dao.init.repositories.treasury_withdraw',
    () => new TreasuryWithdrawRepository()
  );

  await withTraceAsync(
    'dao.init.repositories_plugin.mongoose',
    async (ctx) => {
      logger.info("Connecting to MongoDB", { uri: mongoUri });
      mongoose.connection.once('connected', () => {
        logger.info("MongoDB connected successfully");
        ctx.end();
      });
      await mongoose.connect(mongoUri);
    }
  );

  const plugin = withTraceSync(
    'dao.init.repositories.plugin',
    () => new Elysia({ name: "Repositories" })
      .decorate("proposalRepository", proposalRepository)
      .decorate("voteRepository", voteRepository)
      .decorate("stakingRepository", stakingRepository)
      .decorate("stakingHistoryRepository", stakingHistoryRepository)
      .decorate("timelockTaskRepository", timelockTaskRepository)
      .decorate("treasuryWithdrawRepository", treasuryWithdrawRepository)
      .onStop(async () => {
        await withTraceAsync(
          'dao.stop.repositories_plugin',
          async () => {
            logger.info("Disconnecting from MongoDB");
            await mongoose.disconnect();
            logger.info("MongoDB disconnected successfully");
          }
        );
      })
  );

  return plugin;
}

export type RepositoriesPlugin = Awaited<ReturnType<typeof createRepositoriesPlugin>>