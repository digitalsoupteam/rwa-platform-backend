import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { getRawPriceDataController } from "../controllers/getRawPriceData.controller";
import { getOhlcPriceDataController } from "../controllers/getOhlcPriceData.controller";
import { getPoolTransactionsController } from "../controllers/getPoolTransactions.controller";
import { getVolumeDataController } from "../controllers/getVolumeData.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(getRawPriceDataController)
  .use(getOhlcPriceDataController)
  .use(getPoolTransactionsController)
  .use(getVolumeDataController)
  .onStart(async () => {
    logger.debug("Initializing controllers");
  });