import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteFolderRequest,
  deleteFolderResponse,
} from "../../models/validation/documents.validation";

export const deleteFolderController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/deleteFolder",
    async ({ body, documentsService }) => {
      logger.info(
        `POST /deleteFolder - Deleting folder with ID: ${body.id}`
      );

      return await documentsService.deleteFolder(body.id);
    },
    {
      body: deleteFolderRequest,
      response: deleteFolderResponse,
    }
  );