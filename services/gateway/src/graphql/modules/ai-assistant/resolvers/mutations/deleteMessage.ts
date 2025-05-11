import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';
import { AuthenticationError } from '@shared/errors/app-errors';

export const deleteMessage: MutationResolvers['deleteMessage'] = async (
  _parent,
  { id },
  { clients, user }
) => {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get message first to check assistant ownership
  const messageResponse = await clients.aiAssistantClient.getMessage.post({
    id
  });

  if (messageResponse.error) {
    logger.error('Failed to get message:', messageResponse.error);
    throw new Error('Failed to get message');
  }

  // Verify assistant ownership
  const assistantResponse = await clients.aiAssistantClient.getAssistant.post({
    id: messageResponse.data.assistantId
  });

  if (assistantResponse.error || assistantResponse.data.userId !== user.id) {
    throw new Error('Access denied: Message does not belong to the current user');
  }

  logger.info('Deleting message', { id, userId: user.id });

  const response = await clients.aiAssistantClient.deleteMessage.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete message:', response.error);
    throw new Error('Failed to delete message');
  }

  const { data } = response;

  return {
    id: data.id
  };
};