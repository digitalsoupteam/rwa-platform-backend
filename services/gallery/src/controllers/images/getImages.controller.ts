import { Elysia } from 'elysia';
import { type ServicesPlugin } from '../../plugins/services.plugin';
import { getImagesRequest, getImagesResponse } from '../../models/validation/images.validation';

export const getImagesController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'GetImagesController' }).use(servicesPlugin).post(
    '/getImages',
    async ({ body, imagesService }) => {
      return await imagesService.getImages(body);
    },
    {
      body: getImagesRequest,
      response: getImagesResponse,
    },
  );
};
