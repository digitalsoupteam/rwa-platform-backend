import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getFaqTopics: QueryResolvers['getFaqTopics'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting FAQ topics list', { input });

  const response = await clients.faqClient.getTopics.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get topics:', response.error);
    throw new Error('Failed to get topics');
  }

  const { data } = response;

  return data.map(topic => ({
    id: topic.id,
    name: topic.name,
    ownerId: topic.ownerId,
    ownerType: topic.ownerType,
    creator: topic.creator,
    parentId: topic.parentId,
    grandParentId: topic.grandParentId,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
  }));
};