import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { getFileRequest, getFileResponse } from "../models/validation/file.validation";
import type { ServicesPlugin } from "../plugins/services.plugin";

export const getFileController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetFileController" })
    .use(servicesPlugin)
    .post(
      "/getFiles",
      async ({ body, fileService }) => {
        const { id } = body as { id: string };

        logger.info(
          `POST /files/get - Getting file with ID: ${id}`
        );

        const file = await fileService.getFile(id);

        return file;
      },
      {
        body: getFileRequest,
        response: getFileResponse
      }
    );
};