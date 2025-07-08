import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getReferrerClaimHistory: QueryResolvers['getReferrerClaimHistory'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting referrer claim history list', { input });

  const response = await clients.loyaltyClient.getReferrerClaimHistory.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get referrer claim history:', response.error);
    throw new Error('Failed to get referrer claim history');
  }

  const { data } = response;

  return data;
};