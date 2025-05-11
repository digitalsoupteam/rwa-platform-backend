import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getFoldersRequest,
  getFoldersResponse,
} from "../../models/validation/documents.validation";

export const getFoldersController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getFolders",
    async ({ body, documentsService }) => {
      logger.info(
        `POST /getFolders - Getting folders with filters`
      );
      
      return await documentsService.getFolders(body);
    },
    {
      body: getFoldersRequest,
      response: getFoldersResponse,
    }
  );