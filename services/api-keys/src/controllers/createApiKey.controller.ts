import { Elysia } from 'elysia';
import { createApiKeyRequest, createApiKeyResponse } from '../models/validation/apiKey.validation';
import type { ServicesPlugin } from '../plugins/services.plugin';

export const createApiKeyController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'CreateApiKeyController' }).use(servicesPlugin).post(
    '/createApiKey',
    async ({ body, apiKeyService }) => {
      const result = await apiKeyService.createApiKey({
        userId: body.userId,
        wallet: body.wallet,
        name: body.name,
      });

      return result;
    },
    {
      body: createApiKeyRequest,
      response: createApiKeyResponse,
    },
  );
};
