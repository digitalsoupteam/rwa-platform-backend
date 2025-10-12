import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../plugins/services.plugin";
import {
  getTransactionsRequest,
  getTransactionsResponse,
} from "../models/validation/portfolio.validation";

export const getTransactionsController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetTransactionsController" })
    .use(servicesPlugin)
    .post(
      "/getTransactions",
      async ({ body, portfolioService }) => {
        logger.info(
          `POST /getTransactions - Getting transactions`
        );
        
        return await portfolioService.getTransactions(body);
      },
      {
        body: getTransactionsRequest,
        response: getTransactionsResponse,
      }
    );
};