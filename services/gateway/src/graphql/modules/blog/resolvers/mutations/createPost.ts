import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createPost: MutationResolvers['createPost'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new post', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const blogResponse = await clients.blogClient.getBlog.post({
    id: input.blogId
  });

  if (blogResponse.error) {
    logger.error('Failed to get blog:', blogResponse.error);
    throw new Error('Failed to get blog');
  }

  const blog = blogResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: blog.ownerId,
    ownerType: blog.ownerType,
    permission: 'content'
  });

  const response = await clients.blogClient.createPost.post({
    title: input.title,
    content: input.content,
    images: input.images,
    documents: input.documents,
    ownerId: blog.ownerId,
    ownerType: blog.ownerType,
    creator: user.id,
    parentId: blog.parentId,
    grandParentId: blog.grandParentId,
    blogId: blog.id
  });

  if (response.error) {
    logger.error('Failed to create post:', response.error);
    throw new Error('Failed to create post');
  }

  const { data } = response;

  return data;
};