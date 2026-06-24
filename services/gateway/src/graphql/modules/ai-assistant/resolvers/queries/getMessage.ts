import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { AppError } from "@shared/errors/app-errors";

export const getMessage: QueryResolvers['getMessage'] = async (
  _parent,
  { id },
  { clients, user }
) => {
  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  logger.debug('Getting message by ID', { id, userId: user.id });

  const response = await clients.aiAssistantClient.getMessage.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get message:', response.error);
    throw new Error('Failed to get message');
  }

  const { data } = response;

  // Get the assistant to verify ownership
  const assistantResponse = await clients.aiAssistantClient.getAssistant.post({
    id: data.assistantId
  });

  if (assistantResponse.error || assistantResponse.data.userId !== user.id) {
    throw new Error('Access denied: Message does not belong to the current user');
  }

  return {
    id: data.id,
    assistantId: data.assistantId,
    text: data.text,
  };
};
