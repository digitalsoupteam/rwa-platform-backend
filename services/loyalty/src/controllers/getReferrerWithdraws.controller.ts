import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getReferrerWithdrawsRequest,
  getReferrerWithdrawsResponse,
} from "../models/validation/loyalty.validation";

export const getReferrerWithdrawsController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetReferrerWithdrawsController" })
    .use(servicesPlugin)
    .post(
      "/getReferrerWithdraws",
      async ({ body, loyaltyService }) => {
        logger.info(
          `POST /getReferrerWithdraws - Getting referrer withdraws`
        );

        return await loyaltyService.getReferrerWithdraws(body);
      },
      {
        body: getReferrerWithdrawsRequest,
        response: getReferrerWithdrawsResponse,
      }
    );
};