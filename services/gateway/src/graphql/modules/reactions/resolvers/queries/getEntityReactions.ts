import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

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
    throw new AppError({ message: 'Failed to get entity reactions', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return data;
};