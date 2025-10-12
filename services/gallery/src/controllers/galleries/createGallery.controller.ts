import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { type ServicesPlugin } from "../../plugins/services.plugin";
import {
  createGalleryRequest,
  createGalleryResponse,
} from "../../models/validation/images.validation";

export const createGalleryController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "CreateGalleryController" })
    .use(servicesPlugin)
    .post(
      "/createGallery",
      async ({ body, imagesService }) => {
        logger.info(
          `POST /createGallery - Creating gallery with name: ${body.name}`
        );

        return await imagesService.createGallery(body);
      },
      {
        body: createGalleryRequest,
        response: createGalleryResponse,
      }
    );
};