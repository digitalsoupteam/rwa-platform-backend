import { AuthenticationError, ForbiddenError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deleteDocument: MutationResolvers['deleteDocument'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting document', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get document first to check permissions
  const documentResponse = await clients.documentsClient.getDocument.post({
    id
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

  const response = await clients.documentsClient.deleteDocument.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete document:', response.error);
    throw new Error('Failed to delete document');
  }

  return response.data.id;
};