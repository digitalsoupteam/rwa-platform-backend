import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../plugins/services.plugin';
import { updateEndpointRequest, updateEndpointResponse } from '../models/validation/endpoint.validation';

export const updateEndpointController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'UpdateEndpointController' }).use(servicesPlugin).post(
    '/updateEndpoint',
    async ({ body, webhookService }) => {
      return await webhookService.updateEndpoint(body);
    },
    {
      body: updateEndpointRequest,
      response: updateEndpointResponse,
    },
  );
};
