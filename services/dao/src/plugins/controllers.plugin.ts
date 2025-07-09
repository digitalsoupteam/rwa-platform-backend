import { Elysia } from "elysia";
import { getTimelockTasksController } from "../controllers/getTimelockTasks.controller";
import { getProposalsController } from "../controllers/getProposals.controller";
import { getStakingController } from "../controllers/getStaking.controller";
import { getTreasuryWithdrawalsController } from "../controllers/getTreasuryWithdrawals.controller";
import { getStakingHistoryController } from "../controllers/getStakingHistory.controller";
import { getVotesController } from "../controllers/getVotes.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(getTimelockTasksController)
  .use(getProposalsController)
  .use(getStakingController)
  .use(getTreasuryWithdrawalsController)
  .use(getStakingHistoryController)
  .use(getVotesController);