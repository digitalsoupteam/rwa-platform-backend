import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';

export const getEvaluations: QueryResolvers['getEvaluations'] = async (_parent, args, { clients, user }) => {
  const response = await clients.aiEvaluatorClient.getEvaluations.post({
    filter: args.filter ?? {},
    sort: args.sort,
    limit: args.limit,
    offset: args.offset,
  });

  if (response.error) {
    throw new AppError({
      message: 'Failed to get evaluations',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  return response.data;
};
