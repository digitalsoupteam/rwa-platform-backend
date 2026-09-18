import { Elysia } from 'elysia';
import { getApiKeyByIdRequest, getApiKeyByIdResponse } from '../models/validation/apiKey.validation';
import type { ServicesPlugin } from '../plugins/services.plugin';

export const getApiKeyByIdController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'GetApiKeyByIdController' }).use(servicesPlugin).post(
    '/getApiKeyById',
    async ({ body, apiKeyService }) => {
      const result = await apiKeyService.getApiKeyById(body.id);

      return result;
    },
    {
      body: getApiKeyByIdRequest,
      response: getApiKeyByIdResponse,
    },
  );
};
