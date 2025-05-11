import { Elysia } from "elysia";
import { createSignatureTaskController } from "../controllers/createSignatureTask.controller";
import { getSignatureTaskController } from "../controllers/getSignatureTask.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(createSignatureTaskController)
  .use(getSignatureTaskController);