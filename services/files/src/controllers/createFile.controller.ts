import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { createFileRequest, createFileResponse } from "../models/validation/file.validation";
import type { ServicesPlugin } from "../plugins/services.plugin";

export const createFileController = (servicesPlugin: ServicesPlugin, maxFileSize: number) => {
  return new Elysia({ name: "CreateFileController" })
    .use(servicesPlugin)
    .post(
      "/createFile",
      async ({ body, fileService }) => {

        if (body.file.size > maxFileSize) {
          throw new Error(`File size exceeds maximum allowed size of ${maxFileSize} bytes`);
        }

        logger.info(
          `POST /createFile - Creating file`, body
        );

        const result = await fileService.createFile(body);

        return result;
      },
      {
        body: createFileRequest,
        response: createFileResponse
      }
    );
};