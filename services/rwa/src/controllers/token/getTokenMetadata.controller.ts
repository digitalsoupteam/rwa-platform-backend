import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getTokenMetadataRequest,
  getTokenMetadataResponse,
} from "../../models/validation/token.validation";

export const getTokenMetadataController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getTokenMetadata",
    async ({ body, tokenService }) => {
      logger.info(
        `POST /getTokenMetadata - Getting metadata for token: ${body.tokenId}`
      );

      return await tokenService.getTokenMetadata(body.tokenId);
    },
    {
      body: getTokenMetadataRequest,
      response: getTokenMetadataResponse,
    }
  );