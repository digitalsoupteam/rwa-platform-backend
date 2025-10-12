import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getRawPriceDataRequest,
  getRawPriceDataResponse,
} from "../models/validation/charts.validation";

export const getRawPriceDataController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetRawPriceDataController" })
    .use(servicesPlugin)
    .post(
      "/getRawPriceData",
      async ({ body, chartsService }) => {
        logger.info(
          `POST /getRawPriceData - Getting raw price data for pool: ${body.poolAddress}`
        );

        return await chartsService.getRawPriceData(body);
      },
      {
        body: getRawPriceDataRequest,
        response: getRawPriceDataResponse,
      }
    );
};