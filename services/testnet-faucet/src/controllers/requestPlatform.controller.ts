import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";

import { ServicesPlugin } from "../plugins/services.plugin";
import { requestPlatformResponse, requestPlatformSchema } from "../models/validation/faucet.validation";

export const requestPlatformController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "RequestPlatformController" })
    .use(servicesPlugin)
    .post(
      "/requestPlatform",
      async ({ body, faucetService }) => {
        logger.info(`POST /requestPlatform - Requesting PLATFORM for wallet: ${body.wallet}`);

        const request = await faucetService.requestPlatformToken({
          userId: body.userId,
          wallet: body.wallet,
          amount: body.amount,
        });

        return request;
      },
      {
        body: requestPlatformSchema,
        response: requestPlatformResponse,
      }
    );
};