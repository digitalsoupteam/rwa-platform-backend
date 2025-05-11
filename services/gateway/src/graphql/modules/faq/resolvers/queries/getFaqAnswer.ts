import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getFaqAnswer: QueryResolvers['getFaqAnswer'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting FAQ answer by id', { id });

  const response = await clients.faqClient.getAnswer.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get answer:', response.error);
    throw new Error('Failed to get answer');
  }

  const answer = response.data;

  return {
    id: answer.id,
    topicId: answer.topicId,
    question: answer.question,
    answer: answer.answer,
    order: answer.order,
    ownerId: answer.ownerId,
    ownerType: answer.ownerType,
    creator: answer.creator,
    parentId: answer.parentId,
    grandParentId: answer.grandParentId,
    createdAt: answer.createdAt,
    updatedAt: answer.updatedAt,
  };
};