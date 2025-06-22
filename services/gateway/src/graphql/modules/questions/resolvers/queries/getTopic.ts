import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getTopic: QueryResolvers['getTopic'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting topic by id', { id });

  const response = await clients.questionsClient.getTopic.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get topic:', response.error);
    throw new Error('Failed to get topic');
  }

  const topic = response.data;

  return topic;
};