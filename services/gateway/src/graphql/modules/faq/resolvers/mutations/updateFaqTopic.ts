import type { MutationResolvers } from '../../../../generated/types';
import { AppError } from "@shared/errors/app-errors";
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const updateFaqTopic: MutationResolvers['updateFaqTopic'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.debug('Updating FAQ topic', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Get topic first to check permissions
  const topicResponse = await clients.faqClient.getTopic.post({
    id: input.id
  });

  if (topicResponse.error) {
    logger.error('Failed to get FAQ topic:', topicResponse.error);
    throw new AppError({ message: 'Failed to get FAQ topic data', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const topic = topicResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: topic.ownerId,
    ownerType: topic.ownerType,
    permission: 'content'
  });

  const response = await clients.faqClient.updateTopic.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update FAQ topic:', response.error);
    throw new AppError({ message: 'Failed to update FAQ topic', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    parentId: data.parentId,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};
