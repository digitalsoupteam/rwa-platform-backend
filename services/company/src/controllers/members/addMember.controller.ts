import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  addMemberRequest,
  addMemberResponse,
} from "../../models/validation/company.validation";

export const addMemberController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/addMember",
    async ({ body, companyService }) => {
      logger.info(
        `POST /addMember - Adding member ${body.userId} to company ${body.companyId}`
      );

      return await companyService.addMember(body);
    },
    {
      body: addMemberRequest,
      response: addMemberResponse,
    }
  );