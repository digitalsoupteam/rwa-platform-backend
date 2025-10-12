import { Elysia } from "elysia";
import {
  authenticateRequest,
  authenticateResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const createAuthenticateController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "AuthenticateController" })
    .use(servicesPlugin)
    .post(
      "/authenticate",
      async ({ body, authService }) => {
          return await authService.authenticate(body)
      },
      {
        body: authenticateRequest,
        response: authenticateResponse,
      }
    )
};