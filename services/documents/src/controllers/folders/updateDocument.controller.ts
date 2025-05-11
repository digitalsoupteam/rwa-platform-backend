import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateDocumentRequest,
  updateDocumentResponse,
} from "../../models/validation/documents.validation";

export const updateDocumentController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/updateDocument",
    async ({ body, documentsService }) => {
      logger.info(
        `POST /updateDocument - Updating document with ID: ${body.id}`
      );

      return await documentsService.updateDocument(body);
    },
    {
      body: updateDocumentRequest,
      response: updateDocumentResponse,
    }
  );