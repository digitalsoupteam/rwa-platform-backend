import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const requestGas: MutationResolvers['requestGas'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.info('Requesting gas token', { input });

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  const response = await clients.testnetFaucetClient.requestGas.post({
    userId: user.id,
    wallet: user.wallet,
    amount: input.amount,
  });

  console.log(JSON.stringify(response))

  if (response.error) {
    logger.error('Failed to request gas token:', response.error);
    throw new Error('Failed to request gas token');
  }

  const { data } = response;

  return data;
};