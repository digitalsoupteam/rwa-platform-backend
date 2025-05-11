import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getFaqAnswers: QueryResolvers['getFaqAnswers'] = async (
  _parent,
  { filter },
  { clients }
) => {
  logger.info('Getting FAQ answers list', { filter });

  const response = await clients.faqClient.getAnswers.post({
    filter: filter?.filter || {},
    sort: filter?.sort || {},
    limit: filter?.limit,
    offset: filter?.offset,
  });

  if (response.error) {
    logger.error('Failed to get answers:', response.error);
    throw new Error('Failed to get answers');
  }

  const { data } = response;

  return data.map(answer => ({
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
  }));
};