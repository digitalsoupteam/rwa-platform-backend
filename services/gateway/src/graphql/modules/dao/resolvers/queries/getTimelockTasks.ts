import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getTimelockTasks: QueryResolvers['getTimelockTasks'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting timelock tasks list', { input });

  const response = await clients.daoClient.getTimelockTasks.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get timelock tasks:', response.error);
    throw new Error('Failed to get timelock tasks');
  }

  const { data } = response;

  return data;
};