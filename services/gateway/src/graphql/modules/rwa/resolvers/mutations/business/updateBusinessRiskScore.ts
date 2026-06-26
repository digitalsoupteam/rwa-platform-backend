import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const updateBusinessRiskScore: MutationResolvers['updateBusinessRiskScore'] = async (
  _parent,
  { id },
  { services, clients, user },
) => {
  logger.debug('Updating business risk score', { id });

  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  // Get business first to check permissions
  const businessResponse = await clients.rwaClient.getBusiness.post({
    id,
  });

  if (businessResponse.error) {
    logger.error('Failed to get business:', businessResponse.error);
    throw new AppError({
      message: 'Failed to get business data',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const business = businessResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: business.ownerId,
    ownerType: business.ownerType,
    permission: 'content',
  });

  const response = await clients.rwaClient.updateBusinessRiskScore.post({
    id,
  });

  if (response.error) {
    logger.error('Failed to update business risk score:', response.error);
    throw new AppError({
      message: 'Failed to update business risk score',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;

  return data;
};
