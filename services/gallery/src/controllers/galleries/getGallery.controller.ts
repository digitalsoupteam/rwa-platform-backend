import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getGalleryRequest,
  getGalleryResponse,
} from "../../models/validation/images.validation";

export const getGalleryController = new Elysia()
  .use(ServicesPlugin)
  .post(
    "/getGallery",
    async ({ body, imagesService }) => {
      logger.info(
        `POST /getGallery - Getting gallery with ID: ${body.id}`
      );

      return await imagesService.getGallery(body.id);
    },
    {
      body: getGalleryRequest,
      response: getGalleryResponse,
    }
  );