import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getDocuments: QueryResolvers['getDocuments'] = async (
  _parent,
  { filter },
  { clients }
) => {
  logger.info('Getting documents list', { filter });

  const response = await clients.documentsClient.getDocuments.post({
    filter: filter?.filter || {},
    sort: filter?.sort || {},
    limit: filter?.limit,
    offset: filter?.offset,
  });

  if (response.error) {
    logger.error('Failed to get documents:', response.error);
    throw new Error('Failed to get documents');
  }

  const { data } = response;

  return data.map(doc => ({
    id: doc.id,
    folderId: doc.folderId,
    name: doc.name,
    link: doc.link,
    ownerId: doc.ownerId,
    ownerType: doc.ownerType,
    creator: doc.creator,
    parentId: doc.parentId,
    grandParentId: doc.grandParentId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));
};