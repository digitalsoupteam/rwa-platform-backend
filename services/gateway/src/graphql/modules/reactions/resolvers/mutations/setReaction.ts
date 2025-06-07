import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const setReaction: MutationResolvers['setReaction'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.info('Setting reaction', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const response = await clients.reactionsClient.setReaction.post({
    parentId: input.parentId,
    parentType: input.parentType,
    userId: user.id,
    reaction: input.reaction
  });

  if (response.error) {
    logger.error('Failed to set reaction:', response.error);
    throw new Error('Failed to set reaction');
  }

  const { data } = response;

  return data;
};