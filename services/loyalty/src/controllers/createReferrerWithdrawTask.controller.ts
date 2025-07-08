import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  createReferrerWithdrawTaskRequest,
  createReferrerWithdrawTaskResponse,
} from "../models/validation/loyalty.validation";

export const createReferrerWithdrawTaskController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createReferrerWithdrawTask",
    async ({ body, loyaltyService }) => {
      logger.info(
        `POST /createReferrerWithdrawTask - Creating referrer withdraw task for ${body.referrerWallet}`
      );
      
      return await loyaltyService.createReferrerWithdrawTask(body);
    },
    {
      body: createReferrerWithdrawTaskRequest,
      response: createReferrerWithdrawTaskResponse,
    }
  );