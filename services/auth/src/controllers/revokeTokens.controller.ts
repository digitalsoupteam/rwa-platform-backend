import { Elysia } from "elysia";
import {
  revokeTokensRequest,
  revokeTokensResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const createRevokeTokensController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "RevokeTokensController" })
    .use(servicesPlugin)
    .post(
      "/revokeTokens",
      async ({ body, authService }) => {
        return await authService.revokeTokens(body.userId, body.tokenHashes);
      },
      {
        body: revokeTokensRequest,
        response: revokeTokensResponse,
      }
    )
};