import { Elysia } from "elysia";
import { createFileController } from "../controllers/createFile.controller";
import { getFileController } from "../controllers/getFile.controller";
import { updateFileController } from "../controllers/updateFile.controller";
import { deleteFileController } from "../controllers/deleteFile.controller";
import { withTraceSync } from "@shared/monitoring/src/tracing";
import type { ServicesPlugin } from "./services.plugin";

export const createControllersPlugin = (servicesPlugin: ServicesPlugin, maxFileSize: number) => {
  const createFileCtrl = withTraceSync(
    'files.init.controllers.create_file',
    () => createFileController(servicesPlugin, maxFileSize)
  );

  const getFileCtrl = withTraceSync(
    'files.init.controllers.get_file',
    () => getFileController(servicesPlugin)
  );

  const updateFileCtrl = withTraceSync(
    'files.init.controllers.update_file',
    () => updateFileController(servicesPlugin)
  );

  const deleteFileCtrl = withTraceSync(
    'files.init.controllers.delete_file',
    () => deleteFileController(servicesPlugin)
  );

  const plugin = withTraceSync(
    'files.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(createFileCtrl)
      .use(getFileCtrl)
      .use(updateFileCtrl)
      .use(deleteFileCtrl)
  );

  return plugin;
}

export type ControllersPlugin = ReturnType<typeof createControllersPlugin>