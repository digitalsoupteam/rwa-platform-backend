import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { type ServicesPlugin } from "../../plugins/services.plugin";
import {
  createImageRequest,
  createImageResponse,
} from "../../models/validation/images.validation";

export const createImageController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "CreateImageController" })
    .use(servicesPlugin)
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
};