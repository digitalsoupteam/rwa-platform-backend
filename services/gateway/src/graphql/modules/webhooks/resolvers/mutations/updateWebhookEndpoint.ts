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

  // Verify endpoint ownership first
  const endpointResponse = await clients.webhooksClient.getEndpoint.post({
    id: input.id,
    userId: user.id,
    wallet: user.wallet,
  });

  if (endpointResponse.error) {
    if (Number(endpointResponse.error.status) >= 500) {
      throw new AppError({ message: 'Failed to get webhook endpoint', statusCode: 502, code: 'BAD_GATEWAY' });
    }

    throw new AppError({ message: 'Webhook endpoint not found', statusCode: 404, code: 'NOT_FOUND' });
  }

  if (endpointResponse.data.userId !== user.id) {
    throw new AppError({ message: 'Webhook endpoint not found', statusCode: 404, code: 'NOT_FOUND' });
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
