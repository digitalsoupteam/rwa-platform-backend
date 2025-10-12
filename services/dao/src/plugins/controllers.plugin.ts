import { Elysia } from "elysia";
import { getTimelockTasksController } from "../controllers/getTimelockTasks.controller";
import { getProposalsController } from "../controllers/getProposals.controller";
import { getStakingController } from "../controllers/getStaking.controller";
import { getTreasuryWithdrawalsController } from "../controllers/getTreasuryWithdrawals.controller";
import { getStakingHistoryController } from "../controllers/getStakingHistory.controller";
import { getVotesController } from "../controllers/getVotes.controller";
import { ServicesPlugin } from "./services.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const getTimelockTasksCtrl = withTraceSync(
    'dao.init.controllers.get_timelock_tasks',
    () => getTimelockTasksController(servicesPlugin)
  );

  const getProposalsCtrl = withTraceSync(
    'dao.init.controllers.get_proposals',
    () => getProposalsController(servicesPlugin)
  );

  const getStakingCtrl = withTraceSync(
    'dao.init.controllers.get_staking',
    () => getStakingController(servicesPlugin)
  );

  const getTreasuryWithdrawalsCtrl = withTraceSync(
    'dao.init.controllers.get_treasury_withdrawals',
    () => getTreasuryWithdrawalsController(servicesPlugin)
  );

  const getStakingHistoryCtrl = withTraceSync(
    'dao.init.controllers.get_staking_history',
    () => getStakingHistoryController(servicesPlugin)
  );

  const getVotesCtrl = withTraceSync(
    'dao.init.controllers.get_votes',
    () => getVotesController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'dao.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(getTimelockTasksCtrl)
      .use(getProposalsCtrl)
      .use(getStakingCtrl)
      .use(getTreasuryWithdrawalsCtrl)
      .use(getStakingHistoryCtrl)
      .use(getVotesCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>