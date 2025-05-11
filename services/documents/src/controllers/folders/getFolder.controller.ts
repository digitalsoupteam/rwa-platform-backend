import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getFolderRequest,
  getFolderResponse,
} from "../../models/validation/documents.validation";

export const getFolderController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getFolder",
    async ({ body, documentsService }) => {
      logger.info(
        `POST /getFolder - Getting folder with ID: ${body.id}`
      );

      return await documentsService.getFolder(body.id);
    },
    {
      body: getFolderRequest,
      response: getFolderResponse,
    }
  );