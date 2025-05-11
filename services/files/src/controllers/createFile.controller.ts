import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { createFileRequest, createFileResponse } from "../models/validation/file.validation";
import { ServicesPlugin } from "../plugins/services.plugin";
import { CONFIG } from "../config";

export const createFileController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createFile",
    async ({ body, fileService }) => {
      const { file, userId } = body;

      // Check file size
      if (file.size > CONFIG.STORAGE.MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum allowed size of ${CONFIG.STORAGE.MAX_FILE_SIZE} bytes`);
      }

      logger.info(
        `POST /files - Creating file: ${file.name}, size: ${file.size} bytes`
      );

      const result = await fileService.createFile({
        file,
        userId
      });

      return result;
    },
    {
      body: createFileRequest,
      response: createFileResponse
    }
  );