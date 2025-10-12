import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import type { ServicesPlugin } from "../plugins/services.plugin";
import {
  getBalancesRequest,
  getBalancesResponse,
} from "../models/validation/portfolio.validation";

export const getBalancesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetBalancesController" })
    .use(servicesPlugin)
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
};