import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../plugins/services.plugin';
import { createEndpointRequest, createEndpointResponse } from '../models/validation/endpoint.validation';

export const createEndpointController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'CreateEndpointController' }).use(servicesPlugin).post(
    '/createEndpoint',
    async ({ body, webhookService }) => {
      return await webhookService.createEndpoint(body);
    },
    {
      body: createEndpointRequest,
      response: createEndpointResponse,
    },
  );
};
