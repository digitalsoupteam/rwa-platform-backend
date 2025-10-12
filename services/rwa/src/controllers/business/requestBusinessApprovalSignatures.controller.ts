import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  requestBusinessApprovalSignaturesRequest,
  requestBusinessApprovalSignaturesResponse,
} from "../../models/validation/business.validation";

export const requestBusinessApprovalSignaturesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "RequestBusinessApprovalSignaturesController" })
    .use(servicesPlugin)
    .post(
      "/requestBusinessApprovalSignatures",
      async ({ body, businessService }) => {
        logger.info(
          `POST /requestBusinessApprovalSignatures - Requesting approval signatures for business with ID: ${body.id}`
        );

        return await businessService.requestApprovalSignatures(body);
      },
      {
        body: requestBusinessApprovalSignaturesRequest,
        response: requestBusinessApprovalSignaturesResponse,
      }
    );
};