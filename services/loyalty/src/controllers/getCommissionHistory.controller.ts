import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getCommissionHistoryRequest,
  getCommissionHistoryResponse,
} from "../models/validation/loyalty.validation";

export const getCommissionHistoryController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getCommissionHistory",
    async ({ body, loyaltyService }) => {
      logger.info(
        `POST /getCommissionHistory - Getting commission history`
      );
      
      return await loyaltyService.getCommissionHistory(body);
    },
    {
      body: getCommissionHistoryRequest,
      response: getCommissionHistoryResponse,
    }
  );