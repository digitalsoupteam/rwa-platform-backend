import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getBlog: QueryResolvers['getBlog'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting blog by id', { id });

  const response = await clients.blogClient.getBlog.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get blog:', response.error);
    throw new Error('Failed to get blog');
  }

  const blog = response.data;

  return {
    id: blog.id,
    name: blog.name,
    ownerId: blog.ownerId,
    ownerType: blog.ownerType,
    creator: blog.creator,
    parentId: blog.parentId,
    grandParentId: blog.grandParentId,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
  };
};