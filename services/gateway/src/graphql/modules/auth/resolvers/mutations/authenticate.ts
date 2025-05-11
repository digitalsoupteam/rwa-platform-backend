import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const authenticate: MutationResolvers['authenticate'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Authenticating user', { wallet: input.wallet });

  const response = await clients.authClient.authenticate.post({
    wallet: input.wallet,
    signature: input.signature,
    timestamp: input.timestamp
  });

  if (response.error) {
    logger.error('Failed to authenticate:', response.error);
    throw new Error('Failed to authenticate');
  }

  const { data } = response;

  return {
    userId: data.userId,
    wallet: data.wallet,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  };
};