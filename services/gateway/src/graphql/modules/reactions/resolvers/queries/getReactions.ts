import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getReactions: QueryResolvers['getReactions'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting reactions list', { input });

  const response = await clients.reactionsClient.getReactions.post({
    filter: input.filter,
    sort: input.sort,
    limit: input.limit,
    offset: input.offset,
  });

  if (response.error) {
    logger.error('Failed to get reactions:', response.error);
    throw new Error('Failed to get reactions');
  }

  const { data } = response;

  return data;
};
