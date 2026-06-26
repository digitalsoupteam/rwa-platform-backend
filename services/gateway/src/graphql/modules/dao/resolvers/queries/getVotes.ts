import { AppError } from "@shared/errors/app-errors";
import type { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const getVotes: QueryResolvers['getVotes'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting votes list', { input });

  const response = await clients.daoClient.getVotes.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get votes:', response.error);
    throw new AppError({ message: 'Failed to get votes', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return data;
};