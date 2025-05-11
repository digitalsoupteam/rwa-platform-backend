import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';
import { AuthenticationError } from '@shared/errors/app-errors';

export const updateAssistant: MutationResolvers['updateAssistant'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Verify assistant ownership first
  const assistantResponse = await clients.aiAssistantClient.getAssistant.post({
    id: input.id
  });

  if (assistantResponse.error || assistantResponse.data.userId !== user.id) {
    throw new Error('Access denied: Assistant does not belong to the current user');
  }

  logger.info('Updating assistant', { input, userId: user.id });

  const response = await clients.aiAssistantClient.updateAssistant.post({
    id: input.id,
    name: input.name,
    contextPreferences: input.contextPreferences,
  });

  if (response.error) {
    logger.error('Failed to update assistant:', response.error);
    throw new Error('Failed to update assistant');
  }

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    userId: data.userId,
    contextPreferences: data.contextPreferences,
  };
};