import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getReferrals: QueryResolvers['getReferrals'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting referrals list', { input });

  const response = await clients.loyaltyClient.getReferrals.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get referrals:', response.error);
    throw new Error('Failed to get referrals');
  }

  const { data } = response;

  return data;
};