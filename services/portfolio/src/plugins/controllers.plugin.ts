import { Elysia } from "elysia";
import { getBalancesController } from "../controllers/getBalances.controller";
import { getTransactionsController } from "../controllers/getTransactions.controller";
import type { ServicesPlugin } from "./services.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const getBalancesCtrl = withTraceSync(
    'portfolio.init.controllers.get_balances',
    () => getBalancesController(servicesPlugin)
  );

  const getTransactionsCtrl = withTraceSync(
    'portfolio.init.controllers.get_transactions',
    () => getTransactionsController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'portfolio.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(getBalancesCtrl)
      .use(getTransactionsCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>