import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deletePost: MutationResolvers['deletePost'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting post', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get post first to check permissions
  const postResponse = await clients.blogClient.getPost.post({
    id
  });

  if (postResponse.error) {
    logger.error('Failed to get post:', postResponse.error);
    throw new Error('Failed to get post data');
  }

  const post = postResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: post.ownerId,
    ownerType: post.ownerType,
    permission: 'content'
  });

  const response = await clients.blogClient.deletePost.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete post:', response.error);
    throw new Error('Failed to delete post');
  }

  return response.data.id;
};