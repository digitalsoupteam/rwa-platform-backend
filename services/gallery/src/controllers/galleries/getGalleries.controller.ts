import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getGalleriesRequest,
  getGalleriesResponse,
} from "../../models/validation/images.validation";

export const getGalleriesController = new Elysia()
  .use(ServicesPlugin)
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