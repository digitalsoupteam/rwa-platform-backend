import { Elysia } from 'elysia';
import { getApiKeysRequest, getApiKeysResponse } from '../models/validation/apiKey.validation';
import type { ServicesPlugin } from '../plugins/services.plugin';

export const getApiKeysController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'GetApiKeysController' }).use(servicesPlugin).post(
    '/getApiKeys',
    async ({ body, apiKeyService }) => {
      const result = await apiKeyService.getApiKeys({
        userId: body.userId,
      });

      return result;
    },
    {
      body: getApiKeysRequest,
      response: getApiKeysResponse,
    },
  );
};
