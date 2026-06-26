import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { AppError } from "@shared/errors/app-errors";

export const deleteAssistant: MutationResolvers['deleteAssistant'] = async (
  _parent,
  { id },
  { clients, user }
) => {
  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Verify assistant ownership first
  const assistantResponse = await clients.aiAssistantClient.getAssistant.post({
    id
  });

  if (assistantResponse.error || assistantResponse.data.userId !== user.id) {
    throw new AppError({ message: 'Access denied: Assistant does not belong to the current user', statusCode: 403, code: "FORBIDDEN" });
  }

  logger.debug('Deleting assistant', { id, userId: user.id });

  const response = await clients.aiAssistantClient.deleteAssistant.post({
    id
  });

  if (response.error) {
    logger.error('Failed to delete assistant:', response.error);
    throw new AppError({ message: 'Failed to delete assistant', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return {
    id: data.id
  };
};
