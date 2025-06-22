import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getQuestion: QueryResolvers['getQuestion'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting question by id', { id });

  const response = await clients.questionsClient.getQuestion.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get question:', response.error);
    throw new Error('Failed to get question');
  }

  const question = response.data;

  return question;
};