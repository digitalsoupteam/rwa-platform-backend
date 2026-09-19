import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';

export const getApiKey: QueryResolvers['getApiKey'] = async (_parent, { id }, { clients, user }) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  // Verify API key ownership first
  const keyResponse = await clients.apiKeysClient.getApiKeyById.post({ id });

  if (keyResponse.error || keyResponse.data.userId !== user.id) {
    throw new AppError({ message: 'Api key not found', statusCode: 404, code: 'NOT_FOUND' });
  }

  // Scoped call as a second line of defense
  const response = await clients.apiKeysClient.getApiKey.post({ id, userId: user.id });

  if (response.error) {
    throw new AppError({ message: 'Failed to get API key', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data;
};
