import { Elysia } from 'elysia';
import { getApiKeyRequest, getApiKeyResponse } from '../models/validation/apiKey.validation';
import type { ServicesPlugin } from '../plugins/services.plugin';

export const getApiKeyController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'GetApiKeyController' }).use(servicesPlugin).post(
    '/getApiKey',
    async ({ body, apiKeyService }) => {
      const result = await apiKeyService.getApiKey({
        id: body.id,
        userId: body.userId,
      });

      return result;
    },
    {
      body: getApiKeyRequest,
      response: getApiKeyResponse,
    },
  );
};
