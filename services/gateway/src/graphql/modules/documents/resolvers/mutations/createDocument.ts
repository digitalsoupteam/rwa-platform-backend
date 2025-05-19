import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createDocument: MutationResolvers['createDocument'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new document', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get folder info first
  const folderResponse = await clients.documentsClient.getFolder.post({
    id: input.folderId
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

  // Upload file to files service
  const fileResponse = await clients.filesClient.createFile.post({
    file: input.file,
  });

  if (fileResponse.error) {
    logger.error('Failed to upload file:', fileResponse.error);
    throw new Error('Failed to upload file');
  }

  // Create document with file path
  const response = await clients.documentsClient.createDocument.post({
    folderId: input.folderId,
    name: input.name,
    link: fileResponse.data.path,
    ownerId: folder.ownerId,
    ownerType: folder.ownerType,
    creator: user.id,
    parentId: folder.parentId,
    grandParentId: folder.grandParentId,
  });

  if (response.error) {
    logger.error('Failed to create document:', response.error);
    throw new Error('Failed to create document');
  }

  const { data } = response;

  return {
    id: data.id,
    folderId: data.folderId,
    name: data.name,
    link: data.link,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    parentId: data.parentId,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};