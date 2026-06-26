import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getPools: QueryResolvers['getPools'] = async (_parent, { input }, { clients }) => {
  logger.info('Getting pools list', { input });

  const response = await clients.rwaClient.getPools.post({
    filter: input.filter,
    sort: input.sort,
    limit: input.limit,
    offset: input.offset,
  });

  if (response.error) {
    logger.error('Failed to get pools:', response.error);
    throw new AppError({ message: 'Failed to get pools', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data;
};
