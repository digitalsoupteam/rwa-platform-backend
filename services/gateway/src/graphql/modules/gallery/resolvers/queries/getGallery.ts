import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getGallery: QueryResolvers['getGallery'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting gallery by id', { id });

  const response = await clients.galleryClient.getGallery.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get gallery:', response.error);
    throw new Error('Failed to get gallery');
  }

  const gallery = response.data;

  return {
    id: gallery.id,
    name: gallery.name,
    parentId: gallery.parentId,
    ownerId: gallery.ownerId,
    ownerType: gallery.ownerType,
    creator: gallery.creator,
    grandParentId: gallery.grandParentId,
    createdAt: gallery.createdAt,
    updatedAt: gallery.updatedAt,
  };
};