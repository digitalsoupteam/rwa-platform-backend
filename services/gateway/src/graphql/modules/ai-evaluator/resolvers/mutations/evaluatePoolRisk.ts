import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const evaluatePoolRisk: MutationResolvers['evaluatePoolRisk'] = async (
  _parent,
  { poolId },
  { clients, user },
) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const response = await clients.aiEvaluatorClient.evaluatePoolRisk.post({
    poolId,
  });

  if (response.error) {
    throw new AppError({
      message: 'Failed to evaluate pool risk',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  return response.data;
};
