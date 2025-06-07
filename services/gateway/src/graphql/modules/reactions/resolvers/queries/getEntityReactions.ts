import { AuthenticationError } from '@shared/errors/app-errors';
import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getEntityReactions: QueryResolvers['getEntityReactions'] = async (
  _parent,
  { parentId, parentType },
  { clients, user }
) => {
  logger.info('Getting entity reactions', { parentId, parentType });

  const response = await clients.reactionsClient.getEntityReactions.post({
    parentId,
    parentType,
    userId: user?.id
  });

  if (response.error) {
    logger.error('Failed to get entity reactions:', response.error);
    throw new Error('Failed to get entity reactions');
  }

  const { data } = response;

  return data;
};