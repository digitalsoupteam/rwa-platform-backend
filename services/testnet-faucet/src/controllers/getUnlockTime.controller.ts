import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";

import { ServicesPlugin } from "../plugins/services.plugin";
import { getUnlockTimeResponse, getUnlockTimeSchema } from "../models/validation/faucet.validation";

export const getUnlockTimeController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetUnlockTimeController" })
    .use(servicesPlugin)
    .post(
      "/getUnlockTime",
      async ({ body, faucetService }) => {
        logger.info(`POST /getUnlockTime - Getting unlock time for user: ${body.userId}`);

        const unlockTime = await faucetService.getTokenUnlockTime({
          userId: body.userId,
        });

        return unlockTime;
      },
      {
        body: getUnlockTimeSchema,
        response: getUnlockTimeResponse,
      }
    );
};
