import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updateFaqAnswer: MutationResolvers['updateFaqAnswer'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating FAQ answer', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get answer first to check permissions
  const answerResponse = await clients.faqClient.getAnswer.post({
    id: input.id
  });

  if (answerResponse.error) {
    logger.error('Failed to get answer:', answerResponse.error);
    throw new Error('Failed to get answer data');
  }

  const answer = answerResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: answer.ownerId,
    ownerType: answer.ownerType,
    permission: 'content'
  });

  const response = await clients.faqClient.updateAnswer.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update FAQ answer:', response.error);
    throw new Error('Failed to update FAQ answer');
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