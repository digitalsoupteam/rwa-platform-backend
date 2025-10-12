import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { type ServicesPlugin } from "../../plugins/services.plugin";
import {
  updateGalleryRequest,
  updateGalleryResponse,
} from "../../models/validation/images.validation";

export const updateGalleryController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "UpdateGalleryController" })
    .use(servicesPlugin)
    .post(
      "/updateGallery",
      async ({ body, imagesService }) => {
        logger.info(
          `POST /updateGallery - Updating gallery with ID: ${body.id}`
        );

        return await imagesService.updateGallery(body);
      },
      {
        body: updateGalleryRequest,
        response: updateGalleryResponse,
      }
    );
};