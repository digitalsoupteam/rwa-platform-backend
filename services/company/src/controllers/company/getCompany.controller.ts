import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getCompanyRequest,
  getCompanyResponse,
} from "../../models/validation/company.validation";

export const getCompanyController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetCompanyController" })
    .use(servicesPlugin)
  .post(
    "/getCompany",
    async ({ body, companyService }) => {
      logger.info(
        `POST /getCompany - Getting company with ID: ${body.id}`
      );

      return await companyService.getCompany(body.id);
    },
    {
      body: getCompanyRequest,
      response: getCompanyResponse,
    }
  );
};