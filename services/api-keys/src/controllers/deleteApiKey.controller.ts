import { Elysia } from 'elysia';
import { deleteApiKeyRequest, deleteApiKeyResponse } from '../models/validation/apiKey.validation';
import type { ServicesPlugin } from '../plugins/services.plugin';

export const deleteApiKeyController = (servicesPlugin: ServicesPlugin) => {
  return new Elysia({ name: 'DeleteApiKeyController' }).use(servicesPlugin).post(
    '/deleteApiKey',
    async ({ body, apiKeyService }) => {
      const result = await apiKeyService.deleteApiKey({
        id: body.id,
        userId: body.userId,
      });

      return result;
    },
    {
      body: deleteApiKeyRequest,
      response: deleteApiKeyResponse,
    },
  );
};
