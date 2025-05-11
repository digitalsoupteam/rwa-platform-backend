import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updateFolder: MutationResolvers['updateFolder'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating folder', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get folder first to check permissions
  const folderResponse = await clients.documentsClient.getFolder.post({
    id: input.id
  });

  if (folderResponse.error) {
    logger.error('Failed to get folder:', folderResponse.error);
    throw new Error('Failed to get folder data');
  }

  const folder = folderResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: folder.ownerId,
    ownerType: folder.ownerType,
    permission: 'content'
  });

  const response = await clients.documentsClient.updateFolder.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update folder:', response.error);
    throw new Error('Failed to update folder');
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