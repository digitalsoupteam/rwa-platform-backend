import { AuthenticationError } from '@shared/errors/app-errors';
import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getHistory: QueryResolvers['getHistory'] = async (
  _parent,
  { pagination },
  { clients, user }
) => {
  logger.info('Getting faucet request history', { pagination });
  
  if (!user) {
      throw new AuthenticationError('Authentication required');
    }

  const response = await clients.testnetFaucetClient.getHistory.post({
    userId: user.id,
    pagination: {
      limit: pagination?.limit,
      offset: pagination?.offset,
    },
  });

  if (response.error) {
    logger.error('Failed to get faucet request history:', response.error);
    throw new Error('Failed to get faucet request history');
  }

  const { data } = response;

  return data;
};