import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updateGallery: MutationResolvers['updateGallery'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating gallery', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get gallery first to check permissions
  const galleryResponse = await clients.galleryClient.getGallery.post({
    id: input.id
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

  const response = await clients.galleryClient.updateGallery.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update gallery:', response.error);
    throw new Error('Failed to update gallery');
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