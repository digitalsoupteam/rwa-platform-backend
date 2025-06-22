import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getDocuments: QueryResolvers['getDocuments'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting documents list', { input });

  const response = await clients.documentsClient.getDocuments.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
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