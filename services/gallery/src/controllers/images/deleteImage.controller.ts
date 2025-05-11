import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteImageRequest,
  deleteImageResponse,
} from "../../models/validation/images.validation";

export const deleteImageController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/deleteImage",
    async ({ body, imagesService }) => {
      logger.info(
        `POST /deleteImage - Deleting image with ID: ${body.id}`
      );

      return await imagesService.deleteImage(body.id);
    },
    {
      body: deleteImageRequest,
      response: deleteImageResponse,
    }
  );