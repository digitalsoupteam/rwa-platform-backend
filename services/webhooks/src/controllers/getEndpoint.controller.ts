import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../plugins/services.plugin';
import { getEndpointRequest, getEndpointResponse } from '../models/validation/endpoint.validation';

export const getEndpointController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'GetEndpointController' }).use(servicesPlugin).post(
    '/getEndpoint',
    async ({ body, webhookService }) => {
      return await webhookService.getEndpoint(body);
    },
    {
      body: getEndpointRequest,
      response: getEndpointResponse,
    },
  );
};
