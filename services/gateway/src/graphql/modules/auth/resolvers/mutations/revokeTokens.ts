import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const revokeTokens: MutationResolvers['revokeTokens'] = async (_parent, { input }, { clients, user }) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const response = await clients.authClient.revokeTokens.post({
    userId: user.id,
    tokenHashes: input.tokenHashes,
  });

  if (response.error) {
    throw new AppError({
      message: 'Failed to revoke tokens',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;
  return data;
};