import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const registerReferral: MutationResolvers['registerReferral'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.debug('Registering new referral', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Get full user data from auth service
  const userResponse = await clients.authClient.getUser.post({
    userId: user.id,
  });

  if (userResponse.error) {
    logger.error('Failed to get user data', userResponse.error);
    throw new Error('Failed to get user data');
  }

  const userData = userResponse.data;

  let referrerWallet: string | undefined = undefined;
  if (input.referrerId) {
    const referrerResponse = await clients.authClient.getUser.post({
      userId: input.referrerId,
    });
    if (referrerResponse.error) {
      logger.warn('Failed to get referrer user data', { error: referrerResponse.error });
    } else {
      referrerWallet = referrerResponse.data.wallet;
    }
  }

  const response = await clients.loyaltyClient.registerReferral.post({
    userWallet: userData.wallet,
    userId: user.id,
    referrerWallet: referrerWallet,
    referrerId: input.referrerId,
  });

  if (response.error) {
    logger.error('Failed to register referral', response.error);
    throw new Error('Failed to register referral');
  }

  const { data } = response;

  return data;
};
