import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';

export const getApiKeys: QueryResolvers['getApiKeys'] = async (_parent, {}, { clients, user }) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const response = await clients.apiKeysClient.getApiKeys.post({ userId: user.id });

  if (response.error) {
    throw new AppError({ message: 'Failed to get API keys', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data;
};
