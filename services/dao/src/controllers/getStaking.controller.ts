import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getStakingRequest,
  getStakingResponse,
} from "../models/validation/dao.validation";

export const getStakingController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getStaking",
    async ({ body, daoService }) => {
      logger.info(
        `POST /getStaking - Getting staking records`
      );
      
      return await daoService.getStaking(body);
    },
    {
      body: getStakingRequest,
      response: getStakingResponse,
    }
  );