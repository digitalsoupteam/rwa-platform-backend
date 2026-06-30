import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../plugins/services.plugin';
import { deleteEndpointRequest, deleteEndpointResponse } from '../models/validation/endpoint.validation';

export const deleteEndpointController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'DeleteEndpointController' }).use(servicesPlugin).post(
    '/deleteEndpoint',
    async ({ body, webhookService }) => {
      return await webhookService.deleteEndpoint(body);
    },
    {
      body: deleteEndpointRequest,
      response: deleteEndpointResponse,
    },
  );
};
