import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getReferrerWithdraws: QueryResolvers['getReferrerWithdraws'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting referrer withdraws list', { input });

  const response = await clients.loyaltyClient.getReferrerWithdraws.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get referrer withdraws:', response.error);
    throw new Error('Failed to get referrer withdraws');
  }

  const { data } = response;

  return data;
};