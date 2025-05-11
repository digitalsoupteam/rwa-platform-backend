import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';
import { AuthenticationError } from '@shared/errors/app-errors';

export const createAssistant: MutationResolvers['createAssistant'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.info('Creating assistant', { input, userId: user.id });

  const response = await clients.aiAssistantClient.createAssistant.post({
    name: input.name,
    userId: user.id,
    contextPreferences: input.contextPreferences || [],
  });

  if (response.error) {
    logger.error('Failed to create assistant:', response.error);
    throw new Error('Failed to create assistant');
  }

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    userId: data.userId,
    contextPreferences: data.contextPreferences,
  };
};