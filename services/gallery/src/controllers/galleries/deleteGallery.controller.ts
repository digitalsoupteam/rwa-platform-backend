import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { type ServicesPlugin } from "../../plugins/services.plugin";
import {
  deleteGalleryRequest,
  deleteGalleryResponse,
} from "../../models/validation/images.validation";

export const deleteGalleryController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "DeleteGalleryController" })
    .use(servicesPlugin)
    .post(
      "/deleteGallery",
      async ({ body, imagesService }) => {
        logger.info(
          `POST /deleteGallery - Deleting gallery with ID: ${body.id}`
        );

        return await imagesService.deleteGallery(body.id);
      },
      {
        body: deleteGalleryRequest,
        response: deleteGalleryResponse,
      }
    );
};