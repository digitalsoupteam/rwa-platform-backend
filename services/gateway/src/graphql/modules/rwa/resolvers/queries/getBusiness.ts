import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getBusiness: QueryResolvers['getBusiness'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting business by id', { id });

  const response = await clients.rwaClient.getBusiness.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get business:', response.error);
    throw new Error('Failed to get business');
  }

  return response.data;
};