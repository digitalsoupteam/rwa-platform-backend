import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';
import { AuthenticationError } from '@shared/errors/app-errors';

export const getMessageHistory: QueryResolvers['getMessageHistory'] = async (
  _parent,
  { assistantId, pagination },
  { clients, user }
) => {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.info('Getting message history', { assistantId, userId: user.id, pagination });

  // Verify assistant ownership first
  const assistantResponse = await clients.aiAssistantClient.getAssistant.post({
    id: assistantId
  });

  if (assistantResponse.error || assistantResponse.data.userId !== user.id) {
    throw new Error('Access denied: Assistant does not belong to the current user');
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
    throw new Error('Failed to get message history');
  }

  const { data } = response;

  return data.map(message => ({
    id: message.id,
    assistantId: message.assistantId,
    text: message.text,
  }));
};