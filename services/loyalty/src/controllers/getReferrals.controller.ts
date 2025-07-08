import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getReferralsRequest,
  getReferralsResponse,
} from "../models/validation/loyalty.validation";

export const getReferralsController = new Elysia()
  .use(ServicesPlugin)
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