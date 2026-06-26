import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const createDocument: MutationResolvers['createDocument'] = async (
  _parent,
  { input },
  { services, clients, user, fileValidation },
) => {
  logger.debug('Creating new document', { input });

  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  // Validate file MIME type before upload
  if (!fileValidation.DOCUMENTS_ALLOWED_MIME_TYPES.includes(input.file.type)) {
    throw new AppError({
      message: `File type "${input.file.type}" is not allowed. Allowed types: ${fileValidation.DOCUMENTS_ALLOWED_MIME_TYPES.join(', ')}`,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  // Validate file size before upload
  if (input.file.size > fileValidation.DOCUMENTS_MAX_FILE_SIZE) {
    throw new AppError({
      message: `File size exceeds maximum allowed size of ${fileValidation.DOCUMENTS_MAX_FILE_SIZE} bytes`,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  // Get folder info first
  const folderResponse = await clients.documentsClient.getFolder.post({
    id: input.folderId,
  });

  if (folderResponse.error) {
    logger.error('Failed to get folder:', folderResponse.error);
    throw new AppError({
      message: 'Failed to get folder data',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const folder = folderResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: folder.ownerId,
    ownerType: folder.ownerType,
    permission: 'content',
  });

  // Upload file to files service
  const fileResponse = await clients.filesClient.createFile.post({
    file: input.file,
  });

  if (fileResponse.error) {
    logger.error('Failed to upload file:', fileResponse.error);
    throw new AppError({ message: 'Failed to upload file', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  // Create document with file path
  const response = await clients.documentsClient.createDocument.post({
    folderId: input.folderId,
    name: input.name,
    link: fileResponse.data.path,
    mimeType: fileResponse.data.mimeType,
    size: fileResponse.data.size,
    ownerId: folder.ownerId,
    ownerType: folder.ownerType,
    creator: user.id,
    parentId: folder.parentId,
    grandParentId: folder.grandParentId,
  });

  if (response.error) {
    logger.error('Failed to create document:', response.error);
    throw new AppError({
      message: 'Failed to create document',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;

  return {
    id: data.id,
    folderId: data.folderId,
    name: data.name,
    link: data.link,
    mimeType: data.mimeType,
    size: data.size,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    parentId: data.parentId,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};
