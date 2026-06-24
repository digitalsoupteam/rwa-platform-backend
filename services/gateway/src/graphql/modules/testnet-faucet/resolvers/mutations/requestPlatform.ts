import { AppError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const requestPlatform: MutationResolvers['requestPlatform'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.info('Requesting platform token', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
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