import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getPost: QueryResolvers['getPost'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting post by id', { id });

  const response = await clients.blogClient.getPost.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get post:', response.error);
    throw new Error('Failed to get post');
  }

  const post = response.data;

  return post;
};