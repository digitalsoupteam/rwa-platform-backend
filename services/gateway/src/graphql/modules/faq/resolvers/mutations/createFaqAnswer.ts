import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createFaqAnswer: MutationResolvers['createFaqAnswer'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new FAQ answer', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get topic info first
  const topicResponse = await clients.faqClient.getTopic.post({
    id: input.topicId
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


  const response = await clients.faqClient.createAnswer.post({
    topicId: input.topicId,
    question: input.question,
    answer: input.answer,
    order: input.order || 0,
    ownerId: topic.ownerId,
    ownerType: topic.ownerType,
    creator: user.id,
    parentId: topic.parentId,
    grandParentId: topic.grandParentId,
  });

  if (response.error) {
    logger.error('Failed to create FAQ answer:', response.error);
    throw new Error('Failed to create FAQ answer');
  }

  const { data } = response;

  return {
    id: data.id,
    topicId: data.topicId,
    question: data.question,
    answer: data.answer,
    order: data.order,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    parentId: data.parentId,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};