import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deleteFaqAnswer: MutationResolvers['deleteFaqAnswer'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting FAQ answer', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get answer first to check permissions
  const answerResponse = await clients.faqClient.getAnswer.post({
    id
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

  const response = await clients.faqClient.deleteAnswer.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete FAQ answer:', response.error);
    throw new Error('Failed to delete FAQ answer');
  }

  return response.data.id;
};