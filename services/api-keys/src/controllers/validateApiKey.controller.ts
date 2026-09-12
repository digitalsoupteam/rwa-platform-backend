import { Elysia } from 'elysia';
import { validateApiKeyRequest, validateApiKeyResponse } from '../models/validation/apiKey.validation';
import type { ServicesPlugin } from '../plugins/services.plugin';

export const validateApiKeyController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'ValidateApiKeyController' }).use(servicesPlugin).post(
    '/validateApiKey',
    async ({ body, apiKeyService }) => {
      const result = await apiKeyService.validateApiKey(body.apiKey);

      return result;
    },
    {
      body: validateApiKeyRequest,
      response: validateApiKeyResponse,
    },
  );
};
