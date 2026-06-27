import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const createDocument: MutationResolvers['createDocument'] = async (
  _parent,
  { input },
  { services, clients, user, fileValidation },
) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  // Validate file MIME type before upload
  // Strip parameters (e.g. ";charset=utf-8") — only type/subtype matters
  const mimeType = input.file.type.split(';')[0].trim();
  if (!fileValidation.DOCUMENTS_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new AppError({
      message: `File type "${mimeType}" is not allowed. Allowed types: ${fileValidation.DOCUMENTS_ALLOWED_MIME_TYPES.join(', ')}`,
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
    throw new AppError({ message: 'Failed to upload file', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  // Create document with file path
  const response = await clients.documentsClient.createDocument.post({
    folderId: input.folderId,
    name: input.name,
    fileId: fileResponse.data.id,
    path: fileResponse.data.path,
    mimeType: fileResponse.data.mimeType,
    size: fileResponse.data.size,
    ownerId: folder.ownerId,
    ownerType: folder.ownerType,
    creator: user.id,
    parentId: folder.parentId,
    grandParentId: folder.grandParentId,
  });

  if (response.error) {
    // Compensation: delete uploaded file if document creation failed
    await clients.filesClient.deleteFile.post({ id: fileResponse.data.id });
    throw new AppError({ message: 'Failed to create document', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const { data } = response;

  return {
    id: data.id,
    folderId: data.folderId,
    name: data.name,
    fileId: data.fileId,
    path: data.path,
    url: data.url,
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