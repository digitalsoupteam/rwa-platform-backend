import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getCompaniesRequest,
  getCompaniesResponse,
} from "../../models/validation/company.validation";

export const getCompaniesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetCompaniesController" })
    .use(servicesPlugin)
  .post(
    "/getCompanies",
    async ({ body, companyService }) => {
      logger.info(
        `POST /getCompanies - Getting companies list`
      );

      return await companyService.getCompanies(body);
    },
    {
      body: getCompaniesRequest,
      response: getCompaniesResponse,
    }
  );
};