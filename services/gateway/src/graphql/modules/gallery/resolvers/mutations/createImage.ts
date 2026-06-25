import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const createImage: MutationResolvers['createImage'] = async (
  _parent,
  { input },
  { services, clients, user, fileValidation }
) => {
  logger.debug('Creating new image', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Validate file MIME type before upload
  if (!fileValidation.GALLERY_ALLOWED_MIME_TYPES.includes(input.file.type)) {
    throw new AppError({
      message: `File type "${input.file.type}" is not allowed. Allowed types: ${fileValidation.GALLERY_ALLOWED_MIME_TYPES.join(', ')}`,
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }

  // Validate file size before upload
  if (input.file.size > fileValidation.GALLERY_MAX_FILE_SIZE) {
    throw new AppError({
      message: `File size exceeds maximum allowed size of ${fileValidation.GALLERY_MAX_FILE_SIZE} bytes`,
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }

  // Get gallery info first
  const galleryResponse = await clients.galleryClient.getGallery.post({
    id: input.galleryId
  });

  if (galleryResponse.error) {
    logger.error('Failed to get gallery:', galleryResponse.error);
    throw new Error('Failed to get gallery data');
  }

  const gallery = galleryResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: gallery.ownerId,
    ownerType: gallery.ownerType,
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

  const response = await clients.galleryClient.createImage.post({
    galleryId: input.galleryId,
    name: input.name,
    description: input.description,
    link: fileResponse.data.path,
    mimeType: fileResponse.data.mimeType,
    size: fileResponse.data.size,
    ownerId: gallery.ownerId,
    ownerType: gallery.ownerType,
    creator: user.id,
    parentId: gallery.parentId,
    grandParentId: gallery.grandParentId,
  });

  if (response.error) {
    logger.error('Failed to create image:', response.error);
    throw new Error('Failed to create image');
  }

  const { data } = response;

  return {
    id: data.id,
    galleryId: data.galleryId,
    name: data.name,
    description: data.description,
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
