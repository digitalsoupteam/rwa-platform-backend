import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deleteGallery: MutationResolvers['deleteGallery'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting gallery', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
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