import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const updateApiKey: MutationResolvers['updateApiKey'] = async (_parent, { input }, { clients, user }) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const response = await clients.apiKeysClient.updateApiKey.post({
    id: input.id,
    userId: user.id,
    name: input.name,
  });

  if (response.error) {
    throw new AppError({ message: 'Failed to update API key', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data;
};
