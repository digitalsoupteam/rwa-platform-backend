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

  return {
    id: post.id,
    blogId: post.blogId,
    title: post.title,
    content: post.content,
    ownerId: post.ownerId,
    ownerType: post.ownerType,
    creator: post.creator,
    parentId: post.parentId,
    grandParentId: post.grandParentId,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};