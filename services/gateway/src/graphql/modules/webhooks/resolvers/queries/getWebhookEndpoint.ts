import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';

export const getWebhookEndpoint: QueryResolvers['getWebhookEndpoint'] = async (_parent, { id }, { clients, user }) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const response = await clients.webhooksClient.getEndpoint.post({
    id,
    userId: user.id,
    wallet: user.wallet,
  });

  if (response.error || response.data.userId !== user.id) {
    throw new AppError({ message: 'Webhook endpoint not found', statusCode: 404, code: 'NOT_FOUND' });
  }

  return response.data;
};
