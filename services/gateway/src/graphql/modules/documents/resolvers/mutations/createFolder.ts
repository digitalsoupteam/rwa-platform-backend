import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createFolder: MutationResolvers['createFolder'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new folder', { input });

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

  const response = await clients.documentsClient.createFolder.post({
    name: input.name,
    ownerId: ownerId,
    ownerType: ownerType,
    creator: user.id,
    parentId: input.parentId,
    grandParentId,
  });

  if (response.error) {
    logger.error('Failed to create folder:', response.error);
    throw new Error('Failed to create folder');
  }

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    parentId: data.parentId,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};