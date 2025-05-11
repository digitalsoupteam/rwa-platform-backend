import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  removeMemberRequest,
  removeMemberResponse,
} from "../../models/validation/company.validation";

export const removeMemberController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/removeMember",
    async ({ body, companyService }) => {
      logger.info(
        `POST /removeMember - Removing member with ID: ${body.id}`
      );

      return await companyService.removeMember(body.id);
    },
    {
      body: removeMemberRequest,
      response: removeMemberResponse,
    }
  );