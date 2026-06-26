import { AppError } from "@shared/errors/app-errors";
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

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
    throw new AppError({ message: 'Failed to get question', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const question = response.data;

  return question;
};