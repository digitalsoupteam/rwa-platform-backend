import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteDocumentRequest,
  deleteDocumentResponse,
} from "../../models/validation/documents.validation";

export const deleteDocumentController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/deleteDocument",
    async ({ body, documentsService }) => {
      logger.info(
        `POST /deleteDocument - Deleting document with ID: ${body.id}`
      );

      return await documentsService.deleteDocument(body.id);
    },
    {
      body: deleteDocumentRequest,
      response: deleteDocumentResponse,
    }
  );