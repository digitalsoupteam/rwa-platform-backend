import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getQuestions: QueryResolvers['getQuestions'] = async (
  _parent,
  { filter },
  { clients }
) => {
  logger.info('Getting questions list', { filter });

  const response = await clients.questionsClient.getQuestions.post({
    filter: filter?.filter || {},
    sort: filter?.sort || {},
    limit: filter?.limit,
    offset: filter?.offset,
  });

  if (response.error) {
    logger.error('Failed to get questions:', response.error);
    throw new Error('Failed to get questions');
  }

  const { data } = response;

  return data.map(question => ({
    id: question.id,
    topicId: question.topicId,
    text: question.text,
    answer: question.answer,
    answered: question.answered,
    likesCount: question.likesCount,
    ownerId: question.ownerId,
    ownerType: question.ownerType,
    creator: question.creator,
    parentId: question.parentId,
    grandParentId: question.grandParentId,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  }));
};