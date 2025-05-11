import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { createFileController } from "../controllers/createFile.controller";
import { getFileController } from "../controllers/getFile.controller";
import { updateFileController } from "../controllers/updateFile.controller";
import { deleteFileController } from "../controllers/deleteFile.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(createFileController)
  .use(getFileController)
  .use(updateFileController)
  .use(deleteFileController);