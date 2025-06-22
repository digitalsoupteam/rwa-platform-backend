import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getQuestions: QueryResolvers['getQuestions'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting questions list', { input });

  const response = await clients.questionsClient.getQuestions.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get questions:', response.error);
    throw new Error('Failed to get questions');
  }

  const { data } = response;

  return data;
};