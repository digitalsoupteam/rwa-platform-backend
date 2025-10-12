import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateCompanyRequest,
  updateCompanyResponse,
} from "../../models/validation/company.validation";

export const updateCompanyController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdateCompanyController" })
    .use(servicesPlugin)
    .post(
      "/updateCompany",
      async ({ body, companyService }) => {
        logger.info(
          `POST /updateCompany - Updating company with ID: ${body.id}`
        );

        return await companyService.updateCompany(body);
      },
      {
        body: updateCompanyRequest,
        response: updateCompanyResponse,
      }
    );
};