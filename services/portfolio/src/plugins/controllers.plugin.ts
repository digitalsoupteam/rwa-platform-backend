import { Elysia } from "elysia";
import { getBalancesController } from "../controllers/getBalances.controller";
import { getTransactionsController } from "../controllers/getTransactions.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(getBalancesController)
  .use(getTransactionsController);