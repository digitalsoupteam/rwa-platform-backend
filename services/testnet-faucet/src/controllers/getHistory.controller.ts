import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";

import { ServicesPlugin } from "../plugins/services.plugin";
import { getHistoryResponse, getHistorySchema } from "../models/validation/faucet.validation";

export const getHistoryController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getHistory",
    async ({ body, faucetService }) => {
      logger.info(`POST /getHistory - Getting history for user: ${body.userId}`);

      const history = await faucetService.getRequestHistory({
        userId: body.userId,
        limit: body.pagination?.limit,
        offset: body.pagination?.offset,
      });

      return history;
    },
    {
      body: getHistorySchema,
      response: getHistoryResponse,
    }
  );
