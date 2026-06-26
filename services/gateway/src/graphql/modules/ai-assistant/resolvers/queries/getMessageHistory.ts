import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { AppError } from '@shared/errors/app-errors';

export const getMessageHistory: QueryResolvers['getMessageHistory'] = async (
  _parent,
  { assistantId, pagination },
  { clients, user },
) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  logger.debug('Getting message history', { assistantId, userId: user.id, pagination });

  // Verify assistant ownership first
  const assistantResponse = await clients.aiAssistantClient.getAssistant.post({
    id: assistantId,
  });

  if (assistantResponse.error || assistantResponse.data.userId !== user.id) {
    throw new AppError({
      message: 'Access denied: Assistant does not belong to the current user',
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  const response = await clients.aiAssistantClient.getMessageHistory.post({
    assistantId,
    pagination: {
      limit: pagination?.limit,
      offset: pagination?.offset,
    },
  });

  if (response.error) {
    logger.error('Failed to get message history:', response.error);
    throw new AppError({
      message: 'Failed to get message history',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;

  return data.map((message) => ({
    id: message.id,
    assistantId: message.assistantId,
    text: message.text,
  }));
};
