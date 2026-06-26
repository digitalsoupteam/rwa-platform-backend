import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { AppError } from '@shared/errors/app-errors';

export const getUserAssistants: QueryResolvers['getUserAssistants'] = async (
  _parent,
  { pagination },
  { clients, user },
) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  logger.debug('Getting user assistants', { userId: user.id, pagination });

  const response = await clients.aiAssistantClient.getUserAssistants.post({
    userId: user.id,
    pagination: {
      limit: pagination?.limit,
      offset: pagination?.offset,
    },
  });

  if (response.error) {
    logger.error('Failed to get user assistants:', response.error);
    throw new AppError({
      message: 'Failed to get user assistants',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;

  return data.map((assistant) => ({
    id: assistant.id,
    name: assistant.name,
    userId: assistant.userId,
    contextPreferences: assistant.contextPreferences,
  }));
};
