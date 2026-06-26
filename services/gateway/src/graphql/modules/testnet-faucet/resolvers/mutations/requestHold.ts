import { AppError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const requestHold: MutationResolvers['requestHold'] = async (_parent, { input }, { clients, user }) => {
  logger.info('Requesting hold token', { input });

  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const response = await clients.testnetFaucetClient.requestHold.post({
    userId: user.id,
    wallet: user.wallet,
    amount: input.amount,
  });

  if (response.error) {
    logger.error('Failed to request hold token:', response.error);
    throw new AppError({
      message: 'Failed to request hold token',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;

  return data;
};
