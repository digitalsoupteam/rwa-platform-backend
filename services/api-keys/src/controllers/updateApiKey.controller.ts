import { Elysia } from 'elysia';
import { updateApiKeyRequest, updateApiKeyResponse } from '../models/validation/apiKey.validation';
import type { ServicesPlugin } from '../plugins/services.plugin';

export const updateApiKeyController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'UpdateApiKeyController' }).use(servicesPlugin).post(
    '/updateApiKey',
    async ({ body, apiKeyService }) => {
      const result = await apiKeyService.updateApiKey({
        id: body.id,
        userId: body.userId,
        name: body.name,
      });

      return result;
    },
    {
      body: updateApiKeyRequest,
      response: updateApiKeyResponse,
    },
  );
};
