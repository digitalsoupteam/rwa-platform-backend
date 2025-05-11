import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';
import { AuthenticationError } from '@shared/errors/app-errors';

export const updateMessage: MutationResolvers['updateMessage'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get message first to check assistant ownership
  const messageResponse = await clients.aiAssistantClient.getMessage.post({
    id: input.id
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

  logger.info('Updating message', { input, userId: user.id });

  const response = await clients.aiAssistantClient.updateMessage.post({
    id: input.id,
    text: input.text,
  });

  if (response.error) {
    logger.error('Failed to update message:', response.error);
    throw new Error('Failed to update message');
  }

  const { data } = response;

  return {
    id: data.id,
    assistantId: data.assistantId,
    text: data.text,
  };
};