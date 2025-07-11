import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getStaking: QueryResolvers['getStaking'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting staking list', { input });

  const response = await clients.daoClient.getStaking.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get staking:', response.error);
    throw new Error('Failed to get staking');
  }

  const { data } = response;

  return data;
};