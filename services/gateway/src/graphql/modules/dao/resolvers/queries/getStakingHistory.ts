import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getStakingHistory: QueryResolvers['getStakingHistory'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting staking history list', { input });

  const response = await clients.daoClient.getStakingHistory.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get staking history:', response.error);
    throw new Error('Failed to get staking history');
  }

  const { data } = response;

  return data;
};