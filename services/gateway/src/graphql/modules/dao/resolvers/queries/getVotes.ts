import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getVotes: QueryResolvers['getVotes'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting votes list', { input });

  const response = await clients.daoClient.getVotes.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get votes:', response.error);
    throw new Error('Failed to get votes');
  }

  const { data } = response;

  return data;
};