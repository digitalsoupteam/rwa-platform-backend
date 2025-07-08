import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const revokeTokens: MutationResolvers['revokeTokens'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  logger.info('Revoking tokens', { userId: user.id, count: input.tokenHashes.length });

  const response = await clients.authClient.revokeTokens.post({
    userId: user.id,
    tokenHashes: input.tokenHashes
  });

  if (response.error) {
    logger.error('Failed to revoke tokens:', response.error);
    throw new Error('Failed to revoke tokens');
  }

  return response.data;
};