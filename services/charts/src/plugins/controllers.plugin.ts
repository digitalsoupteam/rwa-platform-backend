import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { getRawPriceDataController } from "../controllers/getRawPriceData.controller";
import { getOhlcPriceDataController } from "../controllers/getOhlcPriceData.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(getRawPriceDataController)
  .use(getOhlcPriceDataController)
  .onStart(async () => {
    logger.debug("Initializing controllers");
  });