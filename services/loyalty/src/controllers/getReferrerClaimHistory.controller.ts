import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getReferrerClaimHistoryRequest,
  getReferrerClaimHistoryResponse,
} from "../models/validation/loyalty.validation";

export const getReferrerClaimHistoryController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetReferrerClaimHistoryController" })
    .use(servicesPlugin)
    .post(
      "/getReferrerClaimHistory",
      async ({ body, loyaltyService }) => {
        logger.info(
          `POST /getReferrerClaimHistory - Getting referrer claim history`
        );

        return await loyaltyService.getReferrerClaimHistory(body);
      },
      {
        body: getReferrerClaimHistoryRequest,
        response: getReferrerClaimHistoryResponse,
      }
    );
};