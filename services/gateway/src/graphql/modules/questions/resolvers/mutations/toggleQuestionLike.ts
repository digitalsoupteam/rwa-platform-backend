import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const toggleQuestionLike: MutationResolvers['toggleQuestionLike'] = async (
  _parent,
  { questionId },
  { clients, user }
) => {
  logger.info('Toggling question like', { questionId });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const response = await clients.questionsClient.toggleQuestionLike.post({
    questionId,
    userId: user.id,
  });

  if (response.error) {
    logger.error('Failed to toggle question like:', response.error);
    throw new Error('Failed to toggle question like');
  }

  return response.data.liked;
};