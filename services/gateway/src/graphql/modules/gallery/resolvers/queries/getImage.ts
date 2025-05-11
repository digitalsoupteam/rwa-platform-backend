import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getImage: QueryResolvers['getImage'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting image by id', { id });

  const response = await clients.galleryClient.getImage.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get image:', response.error);
    throw new Error('Failed to get image');
  }

  const image = response.data;

  return {
    id: image.id,
    galleryId: image.galleryId,
    name: image.name,
    description: image.description,
    link: image.link,
    ownerId: image.ownerId,
    ownerType: image.ownerType,
    creator: image.creator,
    parentId: image.parentId,
    grandParentId: image.grandParentId,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
  };
};