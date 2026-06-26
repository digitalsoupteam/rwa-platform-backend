import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const createTopic: MutationResolvers['createTopic'] = async (
  _parent,
  { input },
  { services, clients, user },
) => {
  logger.debug('Creating new topic', { input });

  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const { grandParentId, ownerId, ownerType } = await services.parent.getParentInfo(
    input.type,
    input.parentId,
    user.id,
  );

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId,
    ownerType,
    permission: 'content',
  });

  const response = await clients.questionsClient.createTopic.post({
    name: input.name,
    ownerId,
    ownerType,
    creator: user.id,
    parentId: input.parentId,
    grandParentId,
  });

  if (response.error) {
    logger.error('Failed to create topic:', response.error);
    throw new AppError({ message: 'Failed to create topic', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const { data } = response;

  return data;
};
