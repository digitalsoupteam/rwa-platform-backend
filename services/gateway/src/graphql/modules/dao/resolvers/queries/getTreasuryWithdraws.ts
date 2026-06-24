import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getTreasuryWithdraws: QueryResolvers['getTreasuryWithdraws'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting treasury withdraws list', { input });

  const response = await clients.daoClient.getTreasuryWithdrawals.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get treasury withdraws:', response.error);
    throw new Error('Failed to get treasury withdraws');
  }

  const { data } = response;

  return data;
};