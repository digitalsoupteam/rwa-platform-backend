import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getFolders: QueryResolvers['getFolders'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting folders list', { input });

  const response = await clients.documentsClient.getFolders.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get folders:', response.error);
    throw new Error('Failed to get folders');
  }

  const { data } = response;

  return data.map(folder => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    ownerId: folder.ownerId,
    ownerType: folder.ownerType,
    creator: folder.creator,
    grandParentId: folder.grandParentId,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  }));
};