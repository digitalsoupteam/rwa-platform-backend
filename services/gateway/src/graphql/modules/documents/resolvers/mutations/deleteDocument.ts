import type { MutationResolvers } from '../../../../generated/types';
import { AppError } from "@shared/errors/app-errors";
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const deleteDocument: MutationResolvers['deleteDocument'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.debug('Deleting document', { id });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Get document first to check permissions
  const documentResponse = await clients.documentsClient.getDocument.post({
    id
  });

  if (documentResponse.error) {
    logger.error('Failed to get document:', documentResponse.error);
    throw new AppError({ message: 'Failed to get document data', statusCode: 502, code: "BAD_GATEWAY" });
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
    throw new AppError({ message: 'Failed to delete document', statusCode: 502, code: "BAD_GATEWAY" });
  }

  return response.data.id;
};
