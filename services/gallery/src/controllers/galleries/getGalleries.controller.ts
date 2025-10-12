import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { type ServicesPlugin } from "../../plugins/services.plugin";
import {
  getGalleriesRequest,
  getGalleriesResponse,
} from "../../models/validation/images.validation";

export const getGalleriesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetGalleriesController" })
    .use(servicesPlugin)
    .post(
      "/getGalleries",
      async ({ body, imagesService }) => {
        logger.info(
          `POST /getGalleries - Getting galleries`
        );
        
        return await imagesService.getGalleries(body);
      },
      {
        body: getGalleriesRequest,
        response: getGalleriesResponse,
      }
    );
};