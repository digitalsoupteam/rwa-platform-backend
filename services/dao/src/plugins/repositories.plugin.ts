import { Elysia } from "elysia";
import mongoose from "mongoose";
import { logger } from "@shared/monitoring/src/logger";
import { ProposalRepository } from "../repositories/proposal.repository";
import { VoteRepository } from "../repositories/vote.repository";
import { StakingRepository } from "../repositories/staking.repository";
import { StakingHistoryRepository } from "../repositories/stakingHistory.repository";
import { TimelockTaskRepository } from "../repositories/timelockTask.repository";
import { TreasuryWithdrawRepository } from "../repositories/treasuryWithdraw.repository";
import { CONFIG } from "../config";

export const RepositoriesPlugin = new Elysia({ name: "Repositories" })
  .decorate("proposalRepository", {} as ProposalRepository)
  .decorate("voteRepository", {} as VoteRepository)
  .decorate("stakingRepository", {} as StakingRepository)
  .decorate("stakingHistoryRepository", {} as StakingHistoryRepository)
  .decorate("timelockTaskRepository", {} as TimelockTaskRepository)
  .decorate("treasuryWithdrawRepository", {} as TreasuryWithdrawRepository)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing repositories");
      
      decorator.proposalRepository = new ProposalRepository();
      decorator.voteRepository = new VoteRepository();
      decorator.stakingRepository = new StakingRepository();
      decorator.stakingHistoryRepository = new StakingHistoryRepository();
      decorator.timelockTaskRepository = new TimelockTaskRepository();
      decorator.treasuryWithdrawRepository = new TreasuryWithdrawRepository();

      logger.info("Connecting to MongoDB", {
        uri: CONFIG.MONGODB.URI,
      });

      await mongoose.connect(CONFIG.MONGODB.URI);

      logger.info("MongoDB connected successfully");
    }
  )
  .onStop(async () => {
    logger.info("Disconnecting from MongoDB");
    await mongoose.disconnect();
    logger.info("MongoDB disconnected successfully");
  });