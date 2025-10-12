import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { DaoService } from "../services/dao.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  clientsPlugin: ClientsPlugin
) => {
  const daoService = withTraceSync(
    'dao.init.services.dao',
    () => new DaoService(
      repositoriesPlugin.decorator.proposalRepository,
      repositoriesPlugin.decorator.stakingRepository,
      repositoriesPlugin.decorator.stakingHistoryRepository,
      repositoriesPlugin.decorator.timelockTaskRepository,
      repositoriesPlugin.decorator.treasuryWithdrawRepository,
      repositoriesPlugin.decorator.voteRepository
    )
  );

  const plugin = withTraceSync(
    'dao.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .use(clientsPlugin)
      .decorate("daoService", daoService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>