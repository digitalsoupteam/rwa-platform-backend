import { Elysia } from "elysia";
import { AuthService } from "../services/auth.service";
import { RepositoriesPlugin } from "./repositories.plugin";
import { withTraceSync } from "@shared/monitoring/src/tracing";


export const createServicesPlugin = (
  repositoriesPlugin: RepositoriesPlugin,
  jwtSecret: string,
  accessTokenExpiry: any,
  refreshTokenExpiry: any,
  domainName: string,
  domainVersion: string
) => {
  const authService = withTraceSync(
    'auth.init.services.auth',
    () => new AuthService(
      repositoriesPlugin.decorator.userRepository,
      repositoriesPlugin.decorator.refreshTokenRepository,
      jwtSecret,
      accessTokenExpiry,
      refreshTokenExpiry,
      domainName,
      domainVersion
    )
  )

  const plugin = withTraceSync(
    'auth.init.services.plugin',
    () => new Elysia({ name: "Services" })
      .use(repositoriesPlugin)
      .decorate("authService", authService)
  );

  return plugin;
}

export type ServicesPlugin = ReturnType<typeof createServicesPlugin>