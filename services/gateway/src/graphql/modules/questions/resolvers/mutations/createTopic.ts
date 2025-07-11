import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createTopic: MutationResolvers['createTopic'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new topic', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const { grandParentId, ownerId, ownerType } = await services.parent.getParentInfo(
    input.type,
    input.parentId,
    user.id
  );

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId,
    ownerType,
    permission: 'content'
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
    throw new Error('Failed to create topic');
  }

  const { data } = response;

  return data;
};