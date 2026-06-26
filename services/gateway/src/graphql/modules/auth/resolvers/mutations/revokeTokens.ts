import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const revokeTokens: MutationResolvers['revokeTokens'] = async (_parent, { input }, { clients, user }) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  logger.debug('Revoking tokens', { userId: user.id, count: input.tokenHashes.length });

  const response = await clients.authClient.revokeTokens.post({
    userId: user.id,
    tokenHashes: input.tokenHashes,
  });

  if (response.error) {
    logger.error('Failed to revoke tokens:', response.error);
    throw new AppError({
      message: 'Failed to revoke tokens',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;
  return data;
};
