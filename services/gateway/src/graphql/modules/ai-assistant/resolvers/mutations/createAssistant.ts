import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';
import { AppError } from '@shared/errors/app-errors';

export const createAssistant: MutationResolvers['createAssistant'] = async (_parent, { input }, { clients, user }) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  logger.debug('Creating assistant', { input, userId: user.id });

  const response = await clients.aiAssistantClient.createAssistant.post({
    name: input.name,
    userId: user.id,
    contextPreferences: input.contextPreferences || [],
  });

  if (response.error) {
    logger.error('Failed to create assistant:', response.error);
    throw new AppError({
      message: 'Failed to create assistant',
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
    });
  }

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    userId: data.userId,
    contextPreferences: data.contextPreferences,
  };
};
