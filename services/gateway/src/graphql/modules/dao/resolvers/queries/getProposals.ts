import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getProposals: QueryResolvers['getProposals'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting proposals list', { input });

  const response = await clients.daoClient.getProposals.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get proposals:', response.error);
    throw new Error('Failed to get proposals');
  }

  const { data } = response;

  return data;
};