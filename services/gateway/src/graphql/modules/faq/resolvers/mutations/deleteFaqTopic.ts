import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deleteFaqTopic: MutationResolvers['deleteFaqTopic'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting FAQ topic', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get topic first to check permissions
  const topicResponse = await clients.faqClient.getTopic.post({
    id
  });

  if (topicResponse.error) {
    logger.error('Failed to get FAQ topic:', topicResponse.error);
    throw new Error('Failed to get FAQ topic data');
  }

  const topic = topicResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: topic.ownerId,
    ownerType: topic.ownerType,
    permission: 'content'
  });

  const response = await clients.faqClient.deleteTopic.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete FAQ topic:', response.error);
    throw new Error('Failed to delete FAQ topic');
  }

  return response.data.id;
};