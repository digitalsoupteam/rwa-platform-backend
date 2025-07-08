import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getFees: QueryResolvers['getFees'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting fees list', { input });

  const response = await clients.loyaltyClient.getFees.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get fees:', response.error);
    throw new Error('Failed to get fees');
  }

  const { data } = response;

  return data;
};