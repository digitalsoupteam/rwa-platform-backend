import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createFolderRequest,
  createFolderResponse,
} from "../../models/validation/documents.validation";

export const createFolderController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createFolder",
    async ({ body, documentsService }) => {
      logger.info(
        `POST /createFolder - Creating folder with name: ${body.name}`
      );

      return await documentsService.createFolder(body);
    },
    {
      body: createFolderRequest,
      response: createFolderResponse,
    }
  );