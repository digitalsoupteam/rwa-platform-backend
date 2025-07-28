import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const requestPlatform: MutationResolvers['requestPlatform'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.info('Requesting platform token', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const response = await clients.testnetFaucetClient.requestPlatform.post({
    userId: user.id,
    wallet: user.wallet,
    amount: input.amount,
  });

  if (response.error) {
    logger.error('Failed to request platform token:', response.error);
    throw new Error('Failed to request platform token');
  }

  const { data } = response;

  return data;
};