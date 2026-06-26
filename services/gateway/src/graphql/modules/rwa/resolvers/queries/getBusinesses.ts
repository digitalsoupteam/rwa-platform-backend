import { AppError } from "@shared/errors/app-errors";
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

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
    throw new AppError({ message: 'Failed to get businesses', statusCode: 502, code: "BAD_GATEWAY" });
  }

  return response.data;
};