import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getPool: QueryResolvers['getPool'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting pool by id', { id });

  const response = await clients.rwaClient.getPool.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get pool:', response.error);
    throw new Error('Failed to get pool');
  }

  const pool = response.data;

  return pool;
};