import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getFees: QueryResolvers['getFees'] = async (_parent, { input }, { clients }) => {
  logger.info('Getting fees list', { input });

  const response = await clients.loyaltyClient.getFees.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get fees:', response.error);
    throw new AppError({ message: 'Failed to get fees', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const { data } = response;

  return data;
};
