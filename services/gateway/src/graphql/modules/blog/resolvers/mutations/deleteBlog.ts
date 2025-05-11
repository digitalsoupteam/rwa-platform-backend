import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deleteBlog: MutationResolvers['deleteBlog'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting blog', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get blog first to check permissions
  const blogResponse = await clients.blogClient.getBlog.post({
    id
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

  const response = await clients.blogClient.deleteBlog.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete blog:', response.error);
    throw new Error('Failed to delete blog');
  }

  return response.data.id;
};