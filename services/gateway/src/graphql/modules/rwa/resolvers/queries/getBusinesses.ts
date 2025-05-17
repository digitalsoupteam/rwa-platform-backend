import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getBusinesses: QueryResolvers['getBusinesses'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting businesses list', { input });

  console.log('inputinputinput')
  console.log(input)

  const response = await clients.rwaClient.getBusinesses.post({
    filter: input.filter,
    sort: input.sort,
    limit: input.limit,
    offset: input.offset,
  });

  if (response.error) {
    logger.error('Failed to get businesses:', response.error);
    throw new Error('Failed to get businesses');
  }

  return response.data;
};