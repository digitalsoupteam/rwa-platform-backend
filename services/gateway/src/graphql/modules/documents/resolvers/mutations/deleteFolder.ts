import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deleteFolder: MutationResolvers['deleteFolder'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting folder', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get folder first to check permissions
  const folderResponse = await clients.documentsClient.getFolder.post({
    id
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

  const response = await clients.documentsClient.deleteFolder.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete folder:', response.error);
    throw new Error('Failed to delete folder');
  }

  return response.data.id;
};