import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createReferrerWithdrawTask: MutationResolvers['createReferrerWithdrawTask'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.info('Creating referrer withdraw task', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get full user data from auth service
  const userResponse = await clients.authClient.getUser.post({
    userId: user.id,
  });

  if (userResponse.error) {
    logger.error('Failed to get user data:', userResponse.error);
    throw new Error('Failed to get user data');
  }

  const userData = userResponse.data;

  const response = await clients.loyaltyClient.createReferrerWithdrawTask.post({
    referrerWallet: userData.wallet,
    chainId: input.chainId,
    tokenAddress: input.tokenAddress,
    amount: input.amount,
  });

  if (response.error) {
    logger.error('Failed to create referrer withdraw task:', response.error);
    throw new Error('Failed to create referrer withdraw task');
  }

  const { data } = response;

  return data;
};