import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createBlog: MutationResolvers['createBlog'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new blog', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const { grandParentId, ownerId, ownerType } = await services.parent.getParentInfo(
    input.type, 
    input.parentId,
    user.id
  );

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId,
    ownerType,
    permission: 'content'
  });

  const response = await clients.blogClient.createBlog.post({
    name: input.name,
    ownerId: ownerId,
    ownerType,
    creator: user.id,
    parentId: input.parentId,
    grandParentId,
  });

  if (response.error) {
    logger.error('Failed to create blog:', response.error);
    throw new Error('Failed to create blog');
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