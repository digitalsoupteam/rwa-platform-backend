import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createDocumentRequest,
  createDocumentResponse,
} from "../../models/validation/documents.validation";

export const createDocumentController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createDocument",
    async ({ body, documentsService }) => {
      logger.info(
        `POST /createDocument - Creating document with name: ${body.name}`
      );

      return await documentsService.createDocument(body);
    },
    {
      body: createDocumentRequest,
      response: createDocumentResponse,
    }
  );