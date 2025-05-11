import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getCompanies: QueryResolvers['getCompanies'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting companies', { input });

  const response = await clients.companyClient.getCompanies.post({
    filter: input?.filter || {},
    sort: input?.sort,
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get companies:', response.error);
    throw new Error('Failed to get companies');
  }

  const { data } = response;

  return data;
};