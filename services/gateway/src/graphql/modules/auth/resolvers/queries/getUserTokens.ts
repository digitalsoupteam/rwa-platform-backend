import { AuthenticationError } from '@shared/errors/app-errors';
import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getUserTokens: QueryResolvers['getUserTokens'] = async (
  _parent,
  { },
  { clients, user }
) => {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.info('Getting user tokens', { userId: user.id });

  const response = await clients.authClient.getUserTokens.post({
    userId: user.id
  });

  if (response.error) {
    logger.error('Failed to get user tokens:', response.error);
    throw new Error('Failed to get user tokens');
  }

  return response.data;
};