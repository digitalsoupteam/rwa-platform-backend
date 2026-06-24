import { AppError } from "@shared/errors/app-errors";
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getUserTokens: QueryResolvers['getUserTokens'] = async (
  _parent,
  { },
  { clients, user }
) => {
  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  logger.debug('Getting user tokens', { userId: user.id });

  const response = await clients.authClient.getUserTokens.post({
    userId: user.id
  });

  if (response.error) {
    logger.error('Failed to get user tokens:', response.error);
    throw new Error('Failed to get user tokens');
  }


  const { data } = response;
  return data;
};
