import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getBalancesRequest,
  getBalancesResponse,
} from "../models/validation/portfolio.validation";

export const getBalancesController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getBalances",
    async ({ body, portfolioService }) => {
      logger.info(
        `POST /getBalances - Getting token balances`
      );
      
      return await portfolioService.getBalances(body);
    },
    {
      body: getBalancesRequest,
      response: getBalancesResponse,
    }
  );