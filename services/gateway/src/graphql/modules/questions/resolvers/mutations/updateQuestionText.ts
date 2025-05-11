import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updateQuestionText: MutationResolvers['updateQuestionText'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating question text', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get question first to check permissions
  const questionResponse = await clients.questionsClient.getQuestion.post({
    id: input.id
  });

  if (questionResponse.error) {
    logger.error('Failed to get question:', questionResponse.error.message);
    throw new Error('Failed to get question data');
  }

  const question = questionResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: question.ownerId,
    ownerType: question.ownerType,
    permission: 'content'
  });

  const response = await clients.questionsClient.updateQuestionText.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update question text:', response.error);
    throw new Error('Failed to update question text');
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