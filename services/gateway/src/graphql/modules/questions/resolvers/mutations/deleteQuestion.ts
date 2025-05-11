import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deleteQuestion: MutationResolvers['deleteQuestion'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting question', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get question first to check permissions
  const questionResponse = await clients.questionsClient.getQuestion.post({
    id
  });

  if (questionResponse.error) {
    logger.error('Failed to get question:', questionResponse.error);
    throw new Error('Failed to get question data');
  }

  const question = questionResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: question.ownerId,
    ownerType: question.ownerType,
    permission: 'content'
  });

  const response = await clients.questionsClient.deleteQuestion.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete question:', response.error);
    throw new Error('Failed to delete question');
  }

  return response.data.id;
};