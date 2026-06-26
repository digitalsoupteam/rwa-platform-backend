import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getPost: QueryResolvers['getPost'] = async (_parent, { id }, { clients }) => {
  logger.info('Getting post by id', { id });

  const response = await clients.blogClient.getPost.post({
    id,
  });

  if (response.error) {
    logger.error('Failed to get post:', response.error);
    throw new AppError({ message: 'Failed to get post', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const post = response.data;

  return post;
};
