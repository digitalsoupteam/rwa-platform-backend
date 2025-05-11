import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getCompany: QueryResolvers['getCompany'] = async (
  _parent,
  { id },
  { services, clients }
) => {
  logger.info('Getting company', { id });

  const response = await services.cache.getCompany({id});

  if (response.error) {
    logger.error('Failed to get company:', response.error);
    throw new Error('Failed to get company');
  }

  const { data } = response;

  return data;
};