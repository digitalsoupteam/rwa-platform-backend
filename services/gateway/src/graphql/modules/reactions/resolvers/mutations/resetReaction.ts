import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const resetReaction: MutationResolvers['resetReaction'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.info('Resetting reaction', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const response = await clients.reactionsClient.resetReaction.post({
    parentId: input.parentId,
    parentType: input.parentType,
    userId: user.id,
    reaction: input.reaction
  });

  if (response.error) {
    logger.error('Failed to reset reaction:', response.error);
    throw new Error('Failed to reset reaction');
  }

  const { data } = response;

  return data;
};