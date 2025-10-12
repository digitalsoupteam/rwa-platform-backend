import { Elysia } from "elysia";
import { getHistoryController } from "../controllers/getHistory.controller";
import { getUnlockTimeController } from "../controllers/getUnlockTime.controller";
import { requestGasController } from "../controllers/requestGas.controller";
import { requestHoldController } from "../controllers/requestHold.controller";
import { requestPlatformController } from "../controllers/requestPlatform.controller";
import { ServicesPlugin } from "./services.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const getHistoryCtrl = withTraceSync(
    'testnet-faucet.init.controllers.get_history',
    () => getHistoryController(servicesPlugin)
  );

  const getUnlockTimeCtrl = withTraceSync(
    'testnet-faucet.init.controllers.get_unlock_time',
    () => getUnlockTimeController(servicesPlugin)
  );

  const requestGasCtrl = withTraceSync(
    'testnet-faucet.init.controllers.request_gas',
    () => requestGasController(servicesPlugin)
  );

  const requestHoldCtrl = withTraceSync(
    'testnet-faucet.init.controllers.request_hold',
    () => requestHoldController(servicesPlugin)
  );

  const requestPlatformCtrl = withTraceSync(
    'testnet-faucet.init.controllers.request_platform',
    () => requestPlatformController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'testnet-faucet.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(getHistoryCtrl)
      .use(getUnlockTimeCtrl)
      .use(requestGasCtrl)
      .use(requestHoldCtrl)
      .use(requestPlatformCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>