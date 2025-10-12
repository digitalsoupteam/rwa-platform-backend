import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { type ServicesPlugin } from "../../plugins/services.plugin";
import {
  getImagesRequest,
  getImagesResponse,
} from "../../models/validation/images.validation";

export const getImagesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: "GetImagesController" })
    .use(servicesPlugin)
    .post(
      "/getImages",
      async ({ body, imagesService }) => {
        logger.info(
          `POST /getImages - Getting images `
        );
        
        return await imagesService.getImages(body);
      },
      {
        body: getImagesRequest,
        response: getImagesResponse,
      }
    );
};