import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { updateFileRequest, updateFileResponse } from "../models/validation/file.validation";
import type { ServicesPlugin } from "../plugins/services.plugin";

export const updateFileController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdateFileController" })
    .use(servicesPlugin)
    .post(
      "/updateFile",
      async ({ body, fileService }) => {
        const { id, name } = body;

        logger.info(
          `POST /files/update - Updating file with ID: ${id}`
        );

        const file = await fileService.updateFile(id, {
          name,
        });

        return file;
      },
      {
        body: updateFileRequest,
        response: updateFileResponse
      }
    );
};