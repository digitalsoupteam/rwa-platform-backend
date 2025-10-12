import { Elysia } from "elysia";
import { createSignatureTaskController } from "../controllers/createSignatureTask.controller";
import { getSignatureTaskController } from "../controllers/getSignatureTask.controller";
import { ServicesPlugin } from "./services.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const createSignatureTaskCtrl = withTraceSync(
    'signers-manager.init.controllers.create_signature_task',
    () => createSignatureTaskController(servicesPlugin)
  );

  const getSignatureTaskCtrl = withTraceSync(
    'signers-manager.init.controllers.get_signature_task',
    () => getSignatureTaskController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'signers-manager.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(createSignatureTaskCtrl)
      .use(getSignatureTaskCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>