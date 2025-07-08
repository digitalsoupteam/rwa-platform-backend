import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  registerReferralRequest,
  registerReferralResponse,
} from "../models/validation/loyalty.validation";

export const registerReferralController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/registerReferral",
    async ({ body, loyaltyService }) => {
      logger.info(
        `POST /registerReferral - Registering referral: ${body.userWallet} -> ${body.referrerWallet}`
      );
      
      const referral = await loyaltyService.registerReferral(body);

      return referral;
    },
    {
      body: registerReferralRequest,
      response: registerReferralResponse,
    }
  );