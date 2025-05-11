import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deleteTopic: MutationResolvers['deleteTopic'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting topic', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get topic first to check permissions
  const topicResponse = await clients.questionsClient.getTopic.post({
    id
  });

  if (topicResponse.error) {
    logger.error('Failed to get topic:', topicResponse.error);
    throw new Error('Failed to get topic data');
  }

  const topic = topicResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: topic.ownerId,
    ownerType: topic.ownerType,
    permission: 'content'
  });

  const response = await clients.questionsClient.deleteTopic.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete topic:', response.error);
    throw new Error('Failed to delete topic');
  }

  return response.data.id;
};