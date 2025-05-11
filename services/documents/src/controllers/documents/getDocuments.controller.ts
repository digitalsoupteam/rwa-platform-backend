import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getDocumentsRequest,
  getDocumentsResponse,
} from "../../models/validation/documents.validation";

export const getDocumentsController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getDocuments",
    async ({ body, documentsService }) => {
      logger.info(
        `POST /getDocuments - Getting documents with filters`
      );
      
      return await documentsService.getDocuments(body);
    },
    {
      body: getDocumentsRequest,
      response: getDocumentsResponse,
    }
  );