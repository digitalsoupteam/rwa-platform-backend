import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updateDocument: MutationResolvers['updateDocument'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating document', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get document first to check permissions
  const documentResponse = await clients.documentsClient.getDocument.post({
    id: input.id
  });

  if (documentResponse.error) {
    logger.error('Failed to get document:', documentResponse.error);
    throw new Error('Failed to get document data');
  }

  const document = documentResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: document.ownerId,
    ownerType: document.ownerType,
    permission: 'content'
  });

  const response = await clients.documentsClient.updateDocument.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update document:', response.error);
    throw new Error('Failed to update document');
  }

  const { data } = response;

  return {
    id: data.id,
    folderId: data.folderId,
    name: data.name,
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