import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const evaluateBusinessRisk: MutationResolvers['evaluateBusinessRisk'] = async (
  _parent,
  { businessId },
  { clients, user },
) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const response = await clients.aiEvaluatorClient.evaluateBusinessRisk.post({
    businessId,
  });

  if (response.error) {
    throw new AppError({
      message: 'Failed to evaluate business risk',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  return response.data;
};
