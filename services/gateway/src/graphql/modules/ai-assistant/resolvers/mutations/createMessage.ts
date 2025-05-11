import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';
import { AuthenticationError } from '@shared/errors/app-errors';

export const createMessage: MutationResolvers['createMessage'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Verify assistant ownership first
  const assistantResponse = await clients.aiAssistantClient.getAssistant.post({
    id: input.assistantId
  });

  if (assistantResponse.error || assistantResponse.data.userId !== user.id) {
    throw new Error('Access denied: Assistant does not belong to the current user');
  }

  logger.info('Creating message', { input, userId: user.id });

  const response = await clients.aiAssistantClient.createMessage.post({
    assistantId: input.assistantId,
    text: input.text,
  });

  if (response.error) {
    logger.error('Failed to create message:', response.error);
    throw new Error('Failed to create message');
  }

  const { data } = response;

  return data.map(message => ({
    id: message.id,
    assistantId: message.assistantId,
    text: message.text,
  }));
};