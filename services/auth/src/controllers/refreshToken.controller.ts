import { Elysia } from "elysia";
import {
  refreshTokenRequest,
  refreshTokenResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const createRefreshTokenController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "RefreshTokenController" })
        .use(servicesPlugin)
        .post(
          "/refreshToken",
          async ({ body, authService }) => {
            return await authService.refreshToken(body);
          },
          {
            body: refreshTokenRequest,
            response: refreshTokenResponse,
          }
        )
};