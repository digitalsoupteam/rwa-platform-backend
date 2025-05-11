import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getPosts: QueryResolvers['getPosts'] = async (
  _parent,
  { filter },
  { clients }
) => {
  logger.info('Getting posts list', { filter });

  const response = await clients.blogClient.getPosts.post({
    filter: filter?.filter || {},
    sort: filter?.sort || {},
    limit: filter?.limit,
    offset: filter?.offset,
  });

  if (response.error) {
    logger.error('Failed to get posts:', response.error);
    throw new Error('Failed to get posts');
  }

  const { data } = response;

  return data.map(post => ({
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
  }));
};