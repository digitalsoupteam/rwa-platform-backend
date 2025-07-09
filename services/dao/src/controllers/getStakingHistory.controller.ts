import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getStakingHistoryRequest,
  getStakingHistoryResponse,
} from "../models/validation/dao.validation";

export const getStakingHistoryController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getStakingHistory",
    async ({ body, daoService }) => {
      logger.info(
        `POST /getStakingHistory - Getting staking history`
      );
      
      return await daoService.getStakingHistory(body);
    },
    {
      body: getStakingHistoryRequest,
      response: getStakingHistoryResponse,
    }
  );