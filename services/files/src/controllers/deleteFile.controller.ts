import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { deleteFileRequest, deleteFileResponse } from "../models/validation/file.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const deleteFileController = new Elysia().use(ServicesPlugin).post(
  "/deleteFile",
  async ({ body, fileService }) => {
    const { id } = body as {
      id: string;
    };

    logger.info(
      `POST /files/delete - Deleting file with ID: ${id}`
    );

    const result = await fileService.deleteFile(id);

    return result;
  },
  {
    body: deleteFileRequest,
    response: deleteFileResponse
  }
);