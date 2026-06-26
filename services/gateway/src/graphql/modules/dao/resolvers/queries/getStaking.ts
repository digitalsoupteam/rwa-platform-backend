import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getStaking: QueryResolvers['getStaking'] = async (_parent, { input }, { clients }) => {
  logger.info('Getting staking list', { input });

  const response = await clients.daoClient.getStaking.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get staking:', response.error);
    throw new AppError({ message: 'Failed to get staking', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const { data } = response;

  return data;
};
