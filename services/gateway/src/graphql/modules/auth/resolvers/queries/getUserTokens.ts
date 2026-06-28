import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';

export const getUserTokens: QueryResolvers['getUserTokens'] = async (_parent, {}, { clients, user }) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const response = await clients.authClient.getUserTokens.post({
    userId: user.id,
  });

  if (response.error) {
    throw new AppError({
      message: 'Failed to get user tokens',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;
  return data;
};
