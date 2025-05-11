import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createCompanyRequest,
  createCompanyResponse,
} from "../../models/validation/company.validation";

export const createCompanyController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createCompany",
    async ({ body, companyService }) => {
      logger.info(
        `POST /createCompany - Creating company with name: ${body.name}`
      );

      return await companyService.createCompany(body);
    },
    {
      body: createCompanyRequest,
      response: createCompanyResponse,
    }
  );