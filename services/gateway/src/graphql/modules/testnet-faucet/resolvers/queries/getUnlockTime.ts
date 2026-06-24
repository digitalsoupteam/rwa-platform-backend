import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getUnlockTime: QueryResolvers['getUnlockTime'] = async (
  _parent,
  { },
  { clients, user }
) => {
  logger.info('Getting token unlock time');

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  const response = await clients.testnetFaucetClient.getUnlockTime.post({
    userId: user.id,
  });

  if (response.error) {
    logger.error('Failed to get token unlock time:', response.error);
    throw new Error('Failed to get token unlock time');
  }

  const { data } = response;

  return data;
};