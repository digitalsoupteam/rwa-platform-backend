import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updatePost: MutationResolvers['updatePost'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating post', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get post first to check permissions
  const postResponse = await clients.blogClient.getPost.post({
    id: input.id
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

  const response = await clients.blogClient.updatePost.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update post:', response.error);
    throw new Error('Failed to update post');
  }

  const { data } = response;

  return data;
};