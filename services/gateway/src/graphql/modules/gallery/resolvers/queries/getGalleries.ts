import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getGalleries: QueryResolvers['getGalleries'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting galleries list', { input });

  const response = await clients.galleryClient.getGalleries.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get galleries:', response.error);
    throw new Error('Failed to get galleries');
  }

  const { data } = response;

  return data.map(gallery => ({
    id: gallery.id,
    name: gallery.name,
    parentId: gallery.parentId,
    ownerId: gallery.ownerId,
    ownerType: gallery.ownerType,
    creator: gallery.creator,
    grandParentId: gallery.grandParentId,
    createdAt: gallery.createdAt,
    updatedAt: gallery.updatedAt,
  }));
};