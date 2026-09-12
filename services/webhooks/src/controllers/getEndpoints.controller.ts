import { Elysia } from 'elysia';
import type { ServicesPlugin } from '../plugins/services.plugin';
import { getEndpointsRequest, getEndpointsResponse } from '../models/validation/endpoint.validation';

export const getEndpointsController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'GetEndpointsController' }).use(servicesPlugin).post(
    '/getEndpoints',
    async ({ body, webhookService }) => {
      return await webhookService.getEndpoints(body);
    },
    {
      body: getEndpointsRequest,
      response: getEndpointsResponse,
    },
  );
};
