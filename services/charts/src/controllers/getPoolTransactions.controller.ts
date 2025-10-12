import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getPoolTransactionsRequest,
  getPoolTransactionsResponse,
} from "../models/validation/poolTransaction.validation";

export const getPoolTransactionsController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetPoolTransactionsController" })
    .use(servicesPlugin)
    .post(
      "/getPoolTransactions",
      async ({ body, transactionsService }) => {
        logger.info(`POST /getPoolTransactions - Getting transactions with filter: ${JSON.stringify(body.filter)}`);
        return await transactionsService.getTransactions(body);
      },
      {
        body: getPoolTransactionsRequest,
        response: getPoolTransactionsResponse,
      }
    );
};