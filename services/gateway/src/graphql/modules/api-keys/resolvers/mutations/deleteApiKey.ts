import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const deleteApiKey: MutationResolvers['deleteApiKey'] = async (_parent, { id }, { clients, user }) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  // Verify API key ownership first
  const keyResponse = await clients.apiKeysClient.getApiKeyById.post({ id });

  if (keyResponse.error) {
    if (Number(keyResponse.error.status) >= 500) {
      throw new AppError({ message: 'Failed to get API key', statusCode: 502, code: 'BAD_GATEWAY' });
    }

    throw new AppError({ message: 'Api key not found', statusCode: 404, code: 'NOT_FOUND' });
  }

  if (keyResponse.data.userId !== user.id) {
    throw new AppError({ message: 'Api key not found', statusCode: 404, code: 'NOT_FOUND' });
  }

  const response = await clients.apiKeysClient.deleteApiKey.post({
    id,
    userId: user.id,
  });

  if (response.error) {
    throw new AppError({ message: 'Failed to delete API key', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data.id;
};
