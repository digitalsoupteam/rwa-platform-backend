import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updateImage: MutationResolvers['updateImage'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating image', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get image first to check permissions
  const imageResponse = await clients.galleryClient.getImage.post({
    id: input.id
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

  const response = await clients.galleryClient.updateImage.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update image:', response.error);
    throw new Error('Failed to update image');
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