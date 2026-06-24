import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { AppError } from "@shared/errors/app-errors";

export const getAssistant: QueryResolvers['getAssistant'] = async (
  _parent,
  { id },
  { clients, user }
) => {
  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  logger.debug('Getting assistant by ID', { id, userId: user.id });

  const response = await clients.aiAssistantClient.getAssistant.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get assistant:', response.error);
    throw new Error('Failed to get assistant');
  }

  const { data } = response;

  // Verify that the assistant belongs to the current user
  if (data.userId !== user.id) {
    throw new Error('Access denied: Assistant does not belong to the current user');
  }

  return {
    id: data.id,
    name: data.name,
    userId: data.userId,
    contextPreferences: data.contextPreferences,
  };
};
