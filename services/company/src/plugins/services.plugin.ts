import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { CompanyService } from "../services/company.service";
import { RepositoriesPlugin } from "./repositories.plugin";

export const ServicesPlugin = new Elysia({ name: "Services" })
  .use(RepositoriesPlugin)
  .decorate("companyService", {} as CompanyService)
  .onStart(
    async ({
      decorator
    }) => {
      logger.debug("Initializing services");

      decorator.companyService = new CompanyService(
        decorator.companyRepository,
        decorator.memberRepository,
        decorator.permissionRepository
      );
    }
  );