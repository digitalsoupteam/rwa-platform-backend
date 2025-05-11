import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updateBlog: MutationResolvers['updateBlog'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating blog', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get blog first to check permissions
  const blogResponse = await clients.blogClient.getBlog.post({
    id: input.id
  });

  if (blogResponse.error) {
    logger.error('Failed to get blog:', blogResponse.error);
    throw new Error('Failed to get blog data');
  }

  const blog = blogResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: blog.ownerId,
    ownerType: blog.ownerType,
    permission: 'content'
  });

  const response = await clients.blogClient.updateBlog.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update blog:', response.error);
    throw new Error('Failed to update blog');
  }

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    parentId: data.parentId,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};