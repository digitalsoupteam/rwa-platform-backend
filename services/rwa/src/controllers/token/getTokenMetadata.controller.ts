import { Elysia } from "elysia";
import type { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getTokenMetadataRequest,
  getTokenMetadataResponse,
} from "../../models/validation/token.validation";

export const getTokenMetadataController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetTokenMetadataController" })
    .use(servicesPlugin)
    .post(
      "/getTokenMetadata",
      async ({ body, tokenService }) => {

        return await tokenService.getTokenMetadata(body.tokenId);
      },
      {
        body: getTokenMetadataRequest,
        response: getTokenMetadataResponse,
      }
    );
};