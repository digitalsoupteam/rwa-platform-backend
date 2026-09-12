import { t } from 'elysia';

/*
 * Base model schema
 */
export const apiKeySchema = t.Object({
  id: t.String(),
  name: t.String(),
  prefix: t.String(),
  userId: t.String(),
  wallet: t.String(),
  createdAt: t.Number(),
  updatedAt: t.Number(),
});

/*
 * Create API key
 */
export const createApiKeyRequest = t.Pick(apiKeySchema, ['name', 'userId', 'wallet']);

export const createApiKeyResponse = t.Composite([
  t.Pick(apiKeySchema, ['id', 'name', 'prefix', 'createdAt']),
  t.Object({ key: t.String() }),
]);

/*
 * Delete API key
 */
export const deleteApiKeyRequest = t.Composite([t.Pick(apiKeySchema, ['id']), t.Pick(apiKeySchema, ['userId'])]);

export const deleteApiKeyResponse = t.Pick(apiKeySchema, ['id']);

/*
 * Get API key
 */
export const getApiKeyRequest = t.Composite([t.Pick(apiKeySchema, ['id']), t.Pick(apiKeySchema, ['userId'])]);

export const getApiKeyResponse = apiKeySchema;

/*
 * Get API keys
 */
export const getApiKeysRequest = t.Pick(apiKeySchema, ['userId']);

export const getApiKeysResponse = t.Array(apiKeySchema);

/*
 * Update API key
 */
export const updateApiKeyRequest = t.Composite([
  t.Pick(apiKeySchema, ['id', 'userId']),
  t.Pick(apiKeySchema, ['name']),
]);

export const updateApiKeyResponse = apiKeySchema;

/*
 * Validate API key
 */
export const validateApiKeyRequest = t.Object({
  apiKey: t.String(),
});

export const validateApiKeyResponse = t.Object({
  userId: t.String(),
  wallet: t.String(),
});
