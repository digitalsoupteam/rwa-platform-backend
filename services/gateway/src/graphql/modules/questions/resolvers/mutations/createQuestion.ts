import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createQuestion: MutationResolvers['createQuestion'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new question', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get topic info first
  const topicResponse = await clients.questionsClient.getTopic.post({
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

  const response = await clients.questionsClient.createQuestion.post({
    topicId: input.topicId,
    text: input.text,
    ownerId: topic.ownerId,
    ownerType: topic.ownerType,
    creator: user.id,
    parentId: topic.parentId,
    grandParentId: topic.grandParentId,
  });

  if (response.error) {
    logger.error('Failed to create question:', response.error);
    throw new Error('Failed to create question');
  }

  const { data } = response;

  return {
    id: data.id,
    topicId: data.topicId,
    text: data.text,
    answer: data.answer,
    answered: data.answered,
    likesCount: data.likesCount,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    parentId: data.parentId,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};