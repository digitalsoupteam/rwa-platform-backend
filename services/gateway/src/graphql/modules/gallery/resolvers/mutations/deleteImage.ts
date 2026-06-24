import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const deleteImage: MutationResolvers['deleteImage'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.debug('Deleting image', { id });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Get image first to check permissions
  const imageResponse = await clients.galleryClient.getImage.post({
    id
  });

  if (imageResponse.error) {
    logger.error('Failed to get image:', imageResponse.error);
    throw new Error('Failed to get image data');
  }

  const image = imageResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: image.ownerId,
    ownerType: image.ownerType,
    permission: 'content'
  });

  const response = await clients.galleryClient.deleteImage.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete image:', response.error);
    throw new Error('Failed to delete image');
  }

  return response.data.id;
};
