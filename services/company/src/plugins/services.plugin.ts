import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { CompanyService } from "../services/company.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";

export const createServicesPlugin = (repositoriesPlugin: RepositoriesPlugin) => {
  const companyService = withTraceSync(
    'company.init.services.company',
    () => new CompanyService(
      repositoriesPlugin.decorator.companyRepository,
      repositoriesPlugin.decorator.memberRepository,
      repositoriesPlugin.decorator.permissionRepository
    )
  );

  const plugin = withTraceSync(
    'company.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .decorate("companyService", companyService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>