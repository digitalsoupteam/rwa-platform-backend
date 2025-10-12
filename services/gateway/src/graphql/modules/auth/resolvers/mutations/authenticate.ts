import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';
import {ethers} from 'ethers'

export const authenticate: MutationResolvers['authenticate'] = async (
  _parent,
  { input },
  { clients },
) => {
  logger.info('Authenticating user', { wallet: input.wallet });

  const authenticateResponse = await clients.authClient.authenticate.post({
    wallet: ethers.getAddress(input.wallet),
    signature: input.signature,
    timestamp: input.timestamp
  });

  if (authenticateResponse.error) {
    logger.error('Failed to authenticate:', authenticateResponse.error);
    throw new Error('Failed to authenticate');
  }

  const { data } = authenticateResponse;
  const result = {
    userId: data.userId,
    wallet: data.wallet,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  };

  return result
};