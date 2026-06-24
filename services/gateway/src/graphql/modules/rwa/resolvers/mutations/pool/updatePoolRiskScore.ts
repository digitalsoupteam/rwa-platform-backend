import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const updatePoolRiskScore: MutationResolvers['updatePoolRiskScore'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.debug('Updating pool risk score', { id });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  const poolResponse = await clients.rwaClient.getPool.post({
    id
  });

  if (poolResponse.error) {
    logger.error('Failed to get pool:', poolResponse.error);
    throw new Error('Failed to get pool data');
  }

  const pool = poolResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: pool.ownerId,
    ownerType: pool.ownerType,
    permission: 'content'
  });

  const response = await clients.rwaClient.updatePoolRiskScore.post({
    id
  });

  if (response.error) {
    logger.error('Failed to update pool risk score:', response.error);
    throw new Error('Failed to update pool risk score');
  }

  const { data } = response;

  return data;
};
