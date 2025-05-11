import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const refreshToken: MutationResolvers['refreshToken'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Refreshing token');

  const response = await clients.authClient.refreshToken.post({
    refreshToken: input.refreshToken
  });

  if (response.error) {
    logger.error('Failed to refresh token:', response.error);
    throw new Error('Failed to refresh token');
  }

  const { data } = response;

  return {
    userId: data.userId,
    wallet: data.wallet,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  };
};