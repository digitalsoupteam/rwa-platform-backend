import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createImage: MutationResolvers['createImage'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new image', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
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

  const response = await clients.galleryClient.createImage.post({
    galleryId: input.galleryId,
    name: input.name,
    description: input.description,
    link: input.link,
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
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    parentId: data.parentId,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};