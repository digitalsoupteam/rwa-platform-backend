import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { type ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateImageRequest,
  updateImageResponse,
} from "../../models/validation/images.validation";

export const updateImageController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdateImageController" })
    .use(servicesPlugin)
    .post(
      "/updateImage",
      async ({ body, imagesService }) => {
        logger.info(
          `POST /updateImage - Updating image with ID: ${body.id}`
        );

        return await imagesService.updateImage(body);
      },
      {
        body: updateImageRequest,
        response: updateImageResponse,
      }
    );
};