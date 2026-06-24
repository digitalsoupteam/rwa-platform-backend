import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const refreshToken: MutationResolvers['refreshToken'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  // if (!user) {
  //   throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  // }

  logger.debug('Refreshing token');

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
