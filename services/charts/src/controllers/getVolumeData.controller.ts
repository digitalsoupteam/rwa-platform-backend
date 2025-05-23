import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../plugins/services.plugin";
import {
  getVolumeDataRequest,
  getVolumeDataResponse,
} from "../models/validation/poolTransaction.validation";

export const getVolumeDataController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getVolumeData",
    async ({ body, transactionsService }) => {
      logger.info(
        `POST /getVolumeData - Getting volume data for pool: ${body.poolAddress}, interval: ${body.interval}`
      );

      return await transactionsService.getVolumeData(body);
    },
    {
      body: getVolumeDataRequest,
      response: getVolumeDataResponse,
    }
  );