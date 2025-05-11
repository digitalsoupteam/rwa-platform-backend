import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  createImageRequest,
  createImageResponse,
} from "../../models/validation/images.validation";

export const createImageController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/createImage",
    async ({ body, imagesService }) => {
      logger.info(
        `POST /createImage - Creating image with name: ${body.name}`
      );

      return await imagesService.createImage(body);
    },
    {
      body: createImageRequest,
      response: createImageResponse,
    }
  );