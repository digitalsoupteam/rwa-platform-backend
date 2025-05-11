import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const requestHold: MutationResolvers['requestHold'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.info('Requesting hold token', { input });

  if (!user) {
      throw new AuthenticationError('Authentication required');
    }

  const response = await clients.testnetFaucetClient.requestHold.post({
    userId: user.id,
    wallet: user.wallet,
    amount: input.amount,
  });

  if (response.error) {
    logger.error('Failed to request hold token:', response.error);
    throw new Error('Failed to request hold token');
  }

  const { data } = response;

  return {
    id: data.id,
    userId: data.userId,
    wallet: data.wallet,
    tokenType: data.tokenType,
    amount: data.amount,
    transactionHash: data.transactionHash,
    createdAt: data.createdAt,
  };
};