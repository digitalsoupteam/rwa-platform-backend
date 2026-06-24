import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const setReaction: MutationResolvers['setReaction'] = async (
  _parent,
  { input },
  { clients, user }
) => {
  logger.debug('Setting reaction', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  const response = await clients.reactionsClient.setReaction.post({
    parentId: input.parentId,
    parentType: input.parentType,
    userId: user.id,
    reaction: input.reaction
  });

  if (response.error) {
    logger.error('Failed to set reaction:', response.error);
    throw new Error('Failed to set reaction');
  }

  const { data } = response;

  return data;
};
