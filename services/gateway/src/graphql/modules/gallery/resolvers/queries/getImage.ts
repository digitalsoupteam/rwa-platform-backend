import { AppError } from "@shared/errors/app-errors";
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

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
    throw new AppError({ message: 'Failed to get image', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const image = response.data;

  return {
    id: image.id,
    galleryId: image.galleryId,
    name: image.name,
    description: image.description,
    link: image.link,
    mimeType: image.mimeType,
    size: image.size,
    ownerId: image.ownerId,
    ownerType: image.ownerType,
    creator: image.creator,
    parentId: image.parentId,
    grandParentId: image.grandParentId,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
  };
};