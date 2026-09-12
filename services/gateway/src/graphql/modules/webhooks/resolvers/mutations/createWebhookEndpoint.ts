import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const createWebhookEndpoint: MutationResolvers['createWebhookEndpoint'] = async (
  _parent,
  { input },
  { clients, user },
) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const response = await clients.webhooksClient.createEndpoint.post({
    userId: user.id,
    wallet: user.wallet,
    url: input.url,
    events: input.events,
    description: input.description ?? undefined,
    rateLimitPerMinute: input.rateLimitPerMinute ?? undefined,
  });

  if (response.error) {
    throw new AppError({ message: 'Failed to create webhook endpoint', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data;
};
