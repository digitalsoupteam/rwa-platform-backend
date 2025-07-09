import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { DaoService } from "../services/dao.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { ClientsPlugin } from "./clients.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .use(ClientsPlugin)
  .decorate("daoService", {} as DaoService)
  .onStart(
    async ({ decorator }) => {
      logger.debug("Initializing services");

      decorator.daoService = new DaoService(
        decorator.proposalRepository,
        decorator.stakingRepository,
        decorator.stakingHistoryRepository,
        decorator.timelockTaskRepository,
        decorator.treasuryWithdrawRepository,
        decorator.voteRepository
      );

      logger.info("DAO service initialized");
    }
  );