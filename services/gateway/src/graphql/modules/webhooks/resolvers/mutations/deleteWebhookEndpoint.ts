import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const deleteWebhookEndpoint: MutationResolvers['deleteWebhookEndpoint'] = async (
  _parent,
  { id },
  { clients, user },
) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const response = await clients.webhooksClient.deleteEndpoint.post({
    id,
    userId: user.id,
    wallet: user.wallet,
  });

  if (response.error) {
    throw new AppError({ message: 'Failed to delete webhook endpoint', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data.id;
};
