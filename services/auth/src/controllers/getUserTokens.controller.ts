import { Elysia } from "elysia";
import {
  getUserTokensRequest,
  getUserTokensResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const createGetUserTokensController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetUserTokensController" })
        .use(servicesPlugin)
        .post(
          "/getUserTokens",
          async ({ body, authService }) => {
            return await authService.getUserTokens(body.userId);
          },
          {
            body: getUserTokensRequest,
            response: getUserTokensResponse,
          }
        )
};
