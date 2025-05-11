import { Elysia } from "elysia";
import { logger } from "@shared/monitoring/src/logger";
import { ServicesPlugin } from "../../plugins/services.plugin";
import {
  getImagesRequest,
  getImagesResponse,
} from "../../models/validation/images.validation";

export const getImagesController = new Elysia()
  .use(ServicesPlugin)
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