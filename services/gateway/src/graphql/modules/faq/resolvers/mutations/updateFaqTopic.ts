import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updateFaqTopic: MutationResolvers['updateFaqTopic'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating FAQ topic', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get topic first to check permissions
  const topicResponse = await clients.faqClient.getTopic.post({
    id: input.id
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

  const response = await clients.faqClient.updateTopic.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update FAQ topic:', response.error);
    throw new Error('Failed to update FAQ topic');
  }

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    parentId: data.parentId,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};