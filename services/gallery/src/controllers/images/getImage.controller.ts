import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { type ServicesPlugin } from "../../plugins/services.plugin";
import {
  getImageRequest,
  getImageResponse,
} from "../../models/validation/images.validation";

export const getImageController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetImageController" })
    .use(servicesPlugin)
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
};