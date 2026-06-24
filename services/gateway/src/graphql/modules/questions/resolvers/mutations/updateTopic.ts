import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const updateTopic: MutationResolvers['updateTopic'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.debug('Updating topic', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Get topic first to check permissions
  const topicResponse = await clients.questionsClient.getTopic.post({
    id: input.id
  });

  if (topicResponse.error) {
    logger.error('Failed to get topic:', topicResponse.error);
    throw new Error('Failed to get topic data');
  }

  const topic = topicResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: topic.ownerId,
    ownerType: topic.ownerType,
    permission: 'content'
  });

  const response = await clients.questionsClient.updateTopic.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update topic:', response.error);
    throw new Error('Failed to update topic');
  }

  const { data } = response;

  return data;
};
