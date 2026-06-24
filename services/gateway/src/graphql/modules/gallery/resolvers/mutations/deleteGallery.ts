import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const deleteGallery: MutationResolvers['deleteGallery'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.debug('Deleting gallery', { id });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Get gallery first to check permissions
  const galleryResponse = await clients.galleryClient.getGallery.post({
    id
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

  const response = await clients.galleryClient.deleteGallery.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete gallery:', response.error);
    throw new Error('Failed to delete gallery');
  }

  return response.data.id;
};
