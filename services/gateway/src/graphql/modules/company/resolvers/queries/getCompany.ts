import { AppError } from "@shared/errors/app-errors";
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getCompany: QueryResolvers['getCompany'] = async (
  _parent,
  { id },
  { services }
) => {
  logger.info('Getting company', { id });

  const response = await services.cache.getCompany({id});

  if (response.error) {
    logger.error('Failed to get company:', response.error);
    throw new AppError({ message: 'Failed to get company', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return data;
};
