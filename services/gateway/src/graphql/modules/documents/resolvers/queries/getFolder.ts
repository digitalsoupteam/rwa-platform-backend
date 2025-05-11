import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getFolder: QueryResolvers['getFolder'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting folder by id', { id });

  const response = await clients.documentsClient.getFolder.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get folder:', response.error);
    throw new Error('Failed to get folder');
  }

  const folder = response.data;

  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    ownerId: folder.ownerId,
    ownerType: folder.ownerType,
    creator: folder.creator,
    grandParentId: folder.grandParentId,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
};