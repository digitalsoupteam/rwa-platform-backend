import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getBusiness: QueryResolvers['getBusiness'] = async (_parent, { id }, { clients }) => {
  logger.info('Getting business by id', { id });

  const response = await clients.rwaClient.getBusiness.post({
    id,
  });

  if (response.error) {
    logger.error('Failed to get business:', response.error);
    throw new AppError({ message: 'Failed to get business', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  return response.data;
};
