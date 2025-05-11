import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";

import { ServicesPlugin } from "../plugins/services.plugin";
import { requestGasResponse, requestGasSchema } from "../models/validation/faucet.validation";

export const requestGasController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/requestGas",
    async ({ body, faucetService }) => {
      logger.info(`POST /requestGas - Requesting gas for wallet: ${body.wallet}`);

      const request = await faucetService.requestGasToken({
        userId: body.userId,
        wallet: body.wallet,
        amount: body.amount,
      });

      return request;
    },
    {
      body: requestGasSchema,
      response: requestGasResponse,
    }
  );
