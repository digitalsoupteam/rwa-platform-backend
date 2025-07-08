import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const refreshToken: MutationResolvers['refreshToken'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.info('Refreshing token');

  const response = await clients.authClient.refreshToken.post({
    refreshToken: input.refreshToken
  });

  if (response.error) {
    logger.error('Failed to refresh token:', response.error);
    throw new Error('Failed to refresh token');
  }

  const { data } = response;

  return data;
};