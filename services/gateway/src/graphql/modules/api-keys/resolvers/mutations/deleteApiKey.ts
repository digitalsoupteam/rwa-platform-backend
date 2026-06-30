import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const deleteApiKey: MutationResolvers['deleteApiKey'] = async (_parent, { id }, { clients, user }) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
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
