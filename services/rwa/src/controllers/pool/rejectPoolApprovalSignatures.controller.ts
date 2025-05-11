import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  rejectPoolApprovalSignaturesRequest,
  rejectPoolApprovalSignaturesResponse,
} from "../../models/validation/pool.validation";

export const rejectPoolApprovalSignaturesController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/rejectPoolApprovalSignatures",
    async ({ body, poolService }) => {
      logger.info(
        `POST /rejectPoolApprovalSignatures - Rejecting approval signatures for pool with ID: ${body.id}`
      );

      return await poolService.rejectApprovalSignatures(body.id);
    },
    {
      body: rejectPoolApprovalSignaturesRequest,
      response: rejectPoolApprovalSignaturesResponse,
    }
  );