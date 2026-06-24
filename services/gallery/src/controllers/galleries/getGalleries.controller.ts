import { Elysia } from "elysia";
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
        
        return await imagesService.getGalleries(body);
      },
      {
        body: getGalleriesRequest,
        response: getGalleriesResponse,
      }
    );
};