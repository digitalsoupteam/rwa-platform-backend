import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getBalances: QueryResolvers['getBalances'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting balances', { input });

  const response = await clients.portfolioClient.getBalances.post({
    filter: input.filter,
    sort: input.sort,
    limit: input.limit,
    offset: input.offset
  });

  if (response.error) {
    logger.error('Failed to get balances:', response.error);
    throw new Error('Failed to get balances');
  }

  const { data } = response;

  return data;
};