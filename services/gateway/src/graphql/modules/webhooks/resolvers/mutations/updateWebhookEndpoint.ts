import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const updateWebhookEndpoint: MutationResolvers['updateWebhookEndpoint'] = async (
  _parent,
  { input },
  { clients, user },
) => {
  if (!user) {
    throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const response = await clients.webhooksClient.updateEndpoint.post({
    id: input.id,
    userId: user.id,
    wallet: user.wallet,
    url: input.url ?? undefined,
    events: input.events ?? undefined,
    description: input.description ?? undefined,
    active: input.active ?? undefined,
    rateLimitPerMinute: input.rateLimitPerMinute ?? undefined,
  });

  if (response.error) {
    throw new AppError({ message: 'Failed to update webhook endpoint', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data;
};
