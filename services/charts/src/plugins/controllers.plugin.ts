import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { getRawPriceDataController } from "../controllers/getRawPriceData.controller";
import { getOhlcPriceDataController } from "../controllers/getOhlcPriceData.controller";
import { getPoolTransactionsController } from "../controllers/getPoolTransactions.controller";
import { getVolumeDataController } from "../controllers/getVolumeData.controller";
import { ServicesPlugin } from "./services.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const getRawPriceDataCtrl = withTraceSync(
    'charts.init.controllers.get_raw_price_data',
    () => getRawPriceDataController(servicesPlugin)
  );

  const getOhlcPriceDataCtrl = withTraceSync(
    'charts.init.controllers.get_ohlc_price_data',
    () => getOhlcPriceDataController(servicesPlugin)
  );

  const getPoolTransactionsCtrl = withTraceSync(
    'charts.init.controllers.get_pool_transactions',
    () => getPoolTransactionsController(servicesPlugin)
  );

  const getVolumeDataCtrl = withTraceSync(
    'charts.init.controllers.get_volume_data',
    () => getVolumeDataController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'charts.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(getRawPriceDataCtrl)
      .use(getOhlcPriceDataCtrl)
      .use(getPoolTransactionsCtrl)
      .use(getVolumeDataCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>