import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getPosts: QueryResolvers['getPosts'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting posts list', { input });

  const response = await clients.blogClient.getPosts.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get posts:', response.error);
    throw new Error('Failed to get posts');
  }

  const { data } = response;

  return data;
};