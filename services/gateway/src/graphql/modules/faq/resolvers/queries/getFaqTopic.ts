import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getFaqTopic: QueryResolvers['getFaqTopic'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting FAQ topic by id', { id });

  const response = await clients.faqClient.getTopic.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get topic:', response.error);
    throw new Error('Failed to get topic');
  }

  const topic = response.data;

  return {
    id: topic.id,
    name: topic.name,
    ownerId: topic.ownerId,
    ownerType: topic.ownerType,
    creator: topic.creator,
    parentId: topic.parentId,
    grandParentId: topic.grandParentId,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
  };
};