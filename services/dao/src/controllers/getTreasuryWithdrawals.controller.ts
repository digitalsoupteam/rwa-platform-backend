import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getTreasuryWithdrawalsRequest,
  getTreasuryWithdrawalsResponse,
} from "../models/validation/dao.validation";

export const getTreasuryWithdrawalsController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetTreasuryWithdrawalsController" })
    .use(servicesPlugin)
    .post(
      "/getTreasuryWithdrawals",
      async ({ body, daoService }) => {
        logger.info(
          `POST /getTreasuryWithdrawals - Getting treasury withdrawals`
        );

        return await daoService.getTreasuryWithdrawals(body);
      },
      {
        body: getTreasuryWithdrawalsRequest,
        response: getTreasuryWithdrawalsResponse,
      }
    );
};