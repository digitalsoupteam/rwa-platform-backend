import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getTopics: QueryResolvers['getTopics'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting topics list', { input });

  const response = await clients.questionsClient.getTopics.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get topics:', response.error);
    throw new Error('Failed to get topics');
  }

  const { data } = response;

  return data;
};