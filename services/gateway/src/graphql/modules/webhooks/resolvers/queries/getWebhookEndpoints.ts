import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';

export const getWebhookEndpoints: QueryResolvers['getWebhookEndpoints'] = async (_parent, {}, { clients, user }) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const response = await clients.webhooksClient.getEndpoints.post({
    userId: user.id,
    wallet: user.wallet,
  });

  if (response.error) {
    throw new AppError({ message: 'Failed to get webhook endpoints', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data;
};
