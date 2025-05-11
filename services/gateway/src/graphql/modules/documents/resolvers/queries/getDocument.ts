import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getDocument: QueryResolvers['getDocument'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting document by id', { id });

  const response = await clients.documentsClient.getDocument.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get document:', response.error);
    throw new Error('Failed to get document');
  }

  const document = response.data;

  return {
    id: document.id,
    folderId: document.folderId,
    name: document.name,
    link: document.link,
    ownerId: document.ownerId,
    ownerType: document.ownerType,
    creator: document.creator,
    parentId: document.parentId,
    grandParentId: document.grandParentId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
};