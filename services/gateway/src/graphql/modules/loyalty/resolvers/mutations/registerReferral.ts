import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const registerReferral: MutationResolvers['registerReferral'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.info('Registering new referral', { input });

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

  // Check if user was created more than 1 hour ago
  const currentTime = Math.floor(Date.now() / 1000);
  const oneHourInSeconds = 3600;
  const timeSinceCreation = currentTime - userData.createdAt;

  if (timeSinceCreation > oneHourInSeconds) {
    logger.warn('User registration attempt after 1 hour limit', {
      userId: user.id,
      createdAt: userData.createdAt,
      timeSinceCreation
    });
    throw new Error('User was already registered');
  }

  const response = await clients.loyaltyClient.registerReferral.post({
    userWallet: userData.wallet,
    referrerWallet: input.referrerWallet,
  });

  if (response.error) {
    logger.error('Failed to register referral:', response.error);
    throw new Error('Failed to register referral');
  }

  const { data } = response;

  return data;
};