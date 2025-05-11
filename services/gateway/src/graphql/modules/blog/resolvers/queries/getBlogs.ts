import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getBlogs: QueryResolvers['getBlogs'] = async (
  _parent,
  { filter },
  { clients }
) => {
  logger.info('Getting blogs list', { filter });

  const response = await clients.blogClient.getBlogs.post({
    filter: filter?.filter || {},
    sort: filter?.sort || {},
    limit: filter?.limit,
    offset: filter?.offset,
  });

  if (response.error) {
    logger.error('Failed to get blogs:', response.error);
    throw new Error('Failed to get blogs');
  }

  const { data } = response;

  return data.map(blog => ({
    id: blog.id,
    name: blog.name,
    ownerId: blog.ownerId,
    ownerType: blog.ownerType,
    creator: blog.creator,
    parentId: blog.parentId,
    grandParentId: blog.grandParentId,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
  }));
};