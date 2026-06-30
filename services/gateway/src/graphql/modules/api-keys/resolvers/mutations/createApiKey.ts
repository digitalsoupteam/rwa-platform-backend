import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const createApiKey: MutationResolvers['createApiKey'] = async (_parent, { input }, { clients, user }) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const response = await clients.apiKeysClient.createApiKey.post({
    userId: user.id,
    wallet: user.wallet,
    name: input.name,
  });

  if (response.error) {
    throw new AppError({ message: 'Failed to create API key', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data;
};
