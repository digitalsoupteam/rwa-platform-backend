import { Elysia } from "elysia";
import { authenticateController } from "../controllers/authenticate.controller";
import { refreshTokenController } from "../controllers/refreshToken.controller";
import { getUserController } from "../controllers/getUser.controller";
import { getUserTokensController } from "../controllers/getUserTokens.controller";
import { revokeTokensController } from "../controllers/revokeTokens.controller";

export const ControllersPlugin = new Elysia({ name: "Controllers" })
  .use(authenticateController)
  .use(refreshTokenController)
  .use(getUserController)
  .use(getUserTokensController)
  .use(revokeTokensController);