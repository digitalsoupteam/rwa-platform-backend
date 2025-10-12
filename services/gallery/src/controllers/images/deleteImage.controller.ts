import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { type ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteImageRequest,
  deleteImageResponse,
} from "../../models/validation/images.validation";

export const deleteImageController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "DeleteImageController" })
    .use(servicesPlugin)
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
};