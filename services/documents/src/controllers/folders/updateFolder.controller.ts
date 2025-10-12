import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateFolderRequest,
  updateFolderResponse,
} from "../../models/validation/documents.validation";

export const updateFolderController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdateFolderController" })
    .use(servicesPlugin)
    .post(
      "/updateFolder",
      async ({ body, documentsService }) => {
        logger.info(
          `POST /updateFolder - Updating folder with ID: ${body.id}`
        );

        return await documentsService.updateFolder(body);
      },
      {
        body: updateFolderRequest,
        response: updateFolderResponse,
      }
    );
};