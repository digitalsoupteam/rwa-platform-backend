import { AuthenticationError } from '@shared/errors/app-errors';
import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getUnlockTime: QueryResolvers['getUnlockTime'] = async (
  _parent,
  { },
  { clients, user }
) => {
  logger.info('Getting token unlock time');
  
  if (!user) {
      throw new AuthenticationError('Authentication required');
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