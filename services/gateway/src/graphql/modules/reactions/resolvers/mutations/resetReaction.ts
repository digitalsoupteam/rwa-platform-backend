import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const resetReaction: MutationResolvers['resetReaction'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.debug('Resetting reaction', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  const response = await clients.reactionsClient.resetReaction.post({
    parentId: input.parentId,
    parentType: input.parentType,
    userId: user.id,
    reaction: input.reaction
  });

  if (response.error) {
    logger.error('Failed to reset reaction:', response.error);
    throw new AppError({ message: 'Failed to reset reaction', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return data;
};
