import { Elysia } from "elysia";
import { getHistoryController } from "../controllers/getHistory.controller";
import { getUnlockTimeController } from "../controllers/getUnlockTime.controller";
import { requestGasController } from "../controllers/requestGas.controller";
import { requestHoldController } from "../controllers/requestHold.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(getHistoryController)
  .use(getUnlockTimeController)
  .use(requestGasController)
  .use(requestHoldController);