import { Elysia } from "elysia";
import {
  getUserRequest,
  getUserResponse,
} from "../models/validation/user.validation";
import { ServicesPlugin } from "../plugins/services.plugin";

export const createGetUserController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetUserController" })
    .use(servicesPlugin)
    .post(
      "/getUser",
      async ({ body, authService }) => {
        return await authService.getUser(body.userId);
      },
      {
        body: getUserRequest,
        response: getUserResponse,
      }
    )
};