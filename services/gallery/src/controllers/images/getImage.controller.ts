import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getImageRequest,
  getImageResponse,
} from "../../models/validation/images.validation";

export const getImageController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getImage",
    async ({ body, imagesService }) => {
      logger.info(
        `POST /getImage - Getting image with ID: ${body.id}`
      );

      return await imagesService.getImage(body.id);
    },
    {
      body: getImageRequest,
      response: getImageResponse,
    }
  );