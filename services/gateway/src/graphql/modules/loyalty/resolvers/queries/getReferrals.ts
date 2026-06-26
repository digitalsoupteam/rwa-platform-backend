import { AppError } from "@shared/errors/app-errors";
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

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
    throw new AppError({ message: 'Failed to get referrals', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return data;
};