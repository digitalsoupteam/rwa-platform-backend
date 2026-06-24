import { Elysia } from "elysia";
import type { ServicesPlugin } from "../../plugins/services.plugin";
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

        return await documentsService.updateFolder(body);
      },
      {
        body: updateFolderRequest,
        response: updateFolderResponse,
      }
    );
};