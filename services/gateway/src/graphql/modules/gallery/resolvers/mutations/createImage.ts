import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const createImage: MutationResolvers['createImage'] = async (
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
  if (!fileValidation.GALLERY_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new AppError({
      message: `File type "${mimeType}" is not allowed. Allowed types: ${fileValidation.GALLERY_ALLOWED_MIME_TYPES.join(', ')}`,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  // Validate file size before upload
  if (input.file.size > fileValidation.GALLERY_MAX_FILE_SIZE) {
    throw new AppError({
      message: `File size exceeds maximum allowed size of ${fileValidation.GALLERY_MAX_FILE_SIZE} bytes`,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  // Get gallery info first
  const galleryResponse = await clients.galleryClient.getGallery.post({
    id: input.galleryId,
  });

  if (galleryResponse.error) {
    throw new AppError({
      message: 'Failed to get gallery data',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const gallery = galleryResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: gallery.ownerId,
    ownerType: gallery.ownerType,
    permission: 'content',
  });

  // Upload file to files service
  const fileResponse = await clients.filesClient.createFile.post({
    file: input.file,
  });

  if (fileResponse.error) {
    throw new AppError({ message: 'Failed to upload file', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const response = await clients.galleryClient.createImage.post({
    galleryId: input.galleryId,
    name: input.name,
    description: input.description,
    fileId: fileResponse.data.id,
    path: fileResponse.data.path,
    mimeType: fileResponse.data.mimeType,
    size: fileResponse.data.size,
    ownerId: gallery.ownerId,
    ownerType: gallery.ownerType,
    creator: user.id,
    parentId: gallery.parentId,
    grandParentId: gallery.grandParentId,
  });

  if (response.error) {
    // Compensation: delete uploaded file if image creation failed
    await clients.filesClient.deleteFile.post({ id: fileResponse.data.id });
    throw new AppError({ message: 'Failed to create image', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const { data } = response;

  return {
    id: data.id,
    galleryId: data.galleryId,
    name: data.name,
    description: data.description,
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
