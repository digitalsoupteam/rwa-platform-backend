import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  grantPermissionRequest,
  grantPermissionResponse,
} from "../../models/validation/company.validation";

export const grantPermissionController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GrantPermissionController" })
    .use(servicesPlugin)
  .post(
    "/grantPermission",
    async ({ body, companyService }) => {
      logger.info(
        `POST /grantPermission - Granting permission ${body.permission} to user ${body.userId} in company ${body.companyId}`
      );

      return await companyService.grantPermission(body);
    },
    {
      body: grantPermissionRequest,
      response: grantPermissionResponse,
    }
  );
};