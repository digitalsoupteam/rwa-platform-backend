import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  revokePermissionRequest,
  revokePermissionResponse,
} from "../../models/validation/company.validation";

export const revokePermissionController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/revokePermission",
    async ({ body, companyService }) => {
      logger.info(
        `POST /revokePermission - Revoking permission with ID: ${body.id}`
      );

      return await companyService.revokePermission(body.id);
    },
    {
      body: revokePermissionRequest,
      response: revokePermissionResponse,
    }
  );