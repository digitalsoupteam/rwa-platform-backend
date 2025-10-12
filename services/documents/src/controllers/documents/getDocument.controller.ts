import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getDocumentRequest,
  getDocumentResponse,
} from "../../models/validation/documents.validation";

export const getDocumentController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetDocumentController" })
    .use(servicesPlugin)
    .post(
      "/getDocument",
      async ({ body, documentsService }) => {
        logger.info(
          `POST /getDocument - Getting document with ID: ${body.id}`
        );

        return await documentsService.getDocument(body.id);
      },
      {
        body: getDocumentRequest,
        response: getDocumentResponse,
      }
    );
};