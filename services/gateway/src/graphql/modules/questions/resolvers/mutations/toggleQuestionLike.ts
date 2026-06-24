import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const toggleQuestionLike: MutationResolvers['toggleQuestionLike'] = async (
  _parent,
  { questionId },
  { clients, user }
) => {
  logger.debug('Toggling question like', { questionId });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
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
