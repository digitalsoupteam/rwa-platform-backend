import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getReferralsRequest,
  getReferralsResponse,
} from "../models/validation/loyalty.validation";

export const getReferralsController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetReferralsController" })
    .use(servicesPlugin)
    .post(
      "/getReferrals",
      async ({ body, loyaltyService }) => {
        logger.info(
          `POST /getReferrals - Getting referrals`
        );

        return await loyaltyService.getReferrals(body);
      },
      {
        body: getReferralsRequest,
        response: getReferralsResponse,
      }
    );
};