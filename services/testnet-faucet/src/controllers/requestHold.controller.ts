import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";

import { ServicesPlugin } from "../plugins/services.plugin";
import { requestHoldResponse, requestHoldSchema } from "../models/validation/faucet.validation";

export const requestHoldController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/requestHold",
    async ({ body, faucetService }) => {
      logger.info(`POST /requestHold - Requesting HOLD for wallet: ${body.wallet}`);

      const request = await faucetService.requestHoldToken({
        userId: body.userId,
        wallet: body.wallet,
        amount: body.amount,
      });

      return request;
    },
    {
      body: requestHoldSchema,
      response: requestHoldResponse,
    }
  );
