import { Elysia } from "elysia";
import { createAuthenticateController } from "../controllers/authenticate.controller";
import { createRefreshTokenController } from "../controllers/refreshToken.controller";
import { createGetUserController } from "../controllers/getUser.controller";
import { createGetUserTokensController } from "../controllers/getUserTokens.controller";
import { createRevokeTokensController } from "../controllers/revokeTokens.controller";
import {  withTraceSync } from "@shared/monitoring/src/tracing";
import { ServicesPlugin } from "./services.plugin";


export const createControllersPlugin = (servicesPlugin: ServicesPlugin) => {
  const authenticateController = withTraceSync(
    'auth.init.controllers.authentication', 
    () => createAuthenticateController(servicesPlugin)
  )

  const refreshTokenController = withTraceSync(
    'auth.init.controllers.refresh_token',
    () => createRefreshTokenController(servicesPlugin)
  )

  const getUserController = withTraceSync(
    'auth.init.controllers.get_user',
    () => createGetUserController(servicesPlugin)
  )

  const getUserTokensController = withTraceSync(
    'auth.init.controllers.get_user_tokens',
    () => createGetUserTokensController(servicesPlugin)
  )

  const revokeTokensController = withTraceSync(
    'auth.init.controllers.revoke',
    () => createRevokeTokensController(servicesPlugin)
  )

  const plugin = withTraceSync(
    'auth.init.controllers.plugin',
    () => new Elysia({ name: "Controllers" })
      .use(authenticateController)
      .use(refreshTokenController)
      .use(getUserController)
      .use(getUserTokensController)
      .use(revokeTokensController)
  )

  return plugin;
}