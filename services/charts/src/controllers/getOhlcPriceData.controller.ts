import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getOhlcPriceDataRequest,
  getOhlcPriceDataResponse,
} from "../models/validation/charts.validation";

export const getOhlcPriceDataController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getOhlcPriceData",
    async ({ body, chartsService }) => {
      logger.info(
        `POST /getOhlcPriceData - Getting OHLC data for pool: ${body.poolAddress}, interval: ${body.interval}`
      );

      return await chartsService.getOhlcPriceData(body);
    },
    {
      body: getOhlcPriceDataRequest,
      response: getOhlcPriceDataResponse,
    }
  );