import type { MutationResolvers } from '../../../../generated/types';
import { AppError } from '@shared/errors/app-errors';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const deleteFaqAnswer: MutationResolvers['deleteFaqAnswer'] = async (
  _parent,
  { id },
  { services, clients, user },
) => {
  logger.debug('Deleting FAQ answer', { id });

  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  // Get answer first to check permissions
  const answerResponse = await clients.faqClient.getAnswer.post({
    id,
  });

  if (answerResponse.error) {
    logger.error('Failed to get answer:', answerResponse.error);
    throw new AppError({
      message: 'Failed to get answer data',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const answer = answerResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: answer.ownerId,
    ownerType: answer.ownerType,
    permission: 'content',
  });

  const response = await clients.faqClient.deleteAnswer.post({
    id,
  });

  if (response.error) {
    logger.error('Failed to delete FAQ answer:', response.error);
    throw new AppError({
      message: 'Failed to delete FAQ answer',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  return response.data.id;
};
