import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getPool: QueryResolvers['getPool'] = async (_parent, { id }, { clients }) => {
  logger.info('Getting pool by id', { id });

  const response = await clients.rwaClient.getPool.post({
    id,
  });

  if (response.error) {
    logger.error('Failed to get pool:', response.error);
    throw new AppError({ message: 'Failed to get pool', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const pool = response.data;

  return pool;
};
