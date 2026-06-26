import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getTopic: QueryResolvers['getTopic'] = async (_parent, { id }, { clients }) => {
  logger.info('Getting topic by id', { id });

  const response = await clients.questionsClient.getTopic.post({
    id,
  });

  if (response.error) {
    logger.error('Failed to get topic:', response.error);
    throw new AppError({ message: 'Failed to get topic', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const topic = response.data;

  return topic;
};
