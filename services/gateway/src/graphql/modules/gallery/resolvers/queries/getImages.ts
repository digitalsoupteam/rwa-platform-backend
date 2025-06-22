import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getImages: QueryResolvers['getImages'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting images list', { input });

  const response = await clients.galleryClient.getImages.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get images:', response.error);
    throw new Error('Failed to get images');
  }

  const { data } = response;

  return data.map(image => ({
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
  }));
};