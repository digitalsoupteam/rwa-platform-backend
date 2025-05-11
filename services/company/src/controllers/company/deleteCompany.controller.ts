import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteCompanyRequest,
  deleteCompanyResponse,
} from "../../models/validation/company.validation";

export const deleteCompanyController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/deleteCompany",
    async ({ body, companyService }) => {
      logger.info(
        `POST /deleteCompany - Deleting company with ID: ${body.id}`
      );

      return await companyService.deleteCompany(body.id);
    },
    {
      body: deleteCompanyRequest,
      response: deleteCompanyResponse,
    }
  );