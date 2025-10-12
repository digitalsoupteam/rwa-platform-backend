import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  requestPoolApprovalSignaturesRequest,
  requestPoolApprovalSignaturesResponse,
} from "../../models/validation/pool.validation";

export const requestPoolApprovalSignaturesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "RequestPoolApprovalSignaturesController" })
    .use(servicesPlugin)
    .post(
      "/requestPoolApprovalSignatures",
      async ({ body, poolService }) => {
        logger.info(
          `POST /requestPoolApprovalSignatures - Requesting approval signatures for pool with ID: ${body.id}`
        );

        return await poolService.requestApprovalSignatures(body);
      },
      {
        body: requestPoolApprovalSignaturesRequest,
        response: requestPoolApprovalSignaturesResponse,
      }
    );
};