import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getHistory: QueryResolvers['getHistory'] = async (
  _parent,
  { pagination },
  { clients, user }
) => {
  logger.info('Getting faucet request history', { pagination });
  
  if (!user) {
      throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
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
    throw new AppError({ message: 'Failed to get faucet request history', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return data;
};