import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  rejectBusinessApprovalSignaturesRequest,
  rejectBusinessApprovalSignaturesResponse,
} from "../../models/validation/business.validation";

export const rejectBusinessApprovalSignaturesController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/rejectBusinessApprovalSignatures",
    async ({ body, businessService }) => {
      logger.info(
        `POST /rejectBusinessApprovalSignatures - Rejecting approval signatures for business with ID: ${body.id}`
      );

      return await businessService.rejectApprovalSignatures(body.id);
    },
    {
      body: rejectBusinessApprovalSignaturesRequest,
      response: rejectBusinessApprovalSignaturesResponse,
    }
  );