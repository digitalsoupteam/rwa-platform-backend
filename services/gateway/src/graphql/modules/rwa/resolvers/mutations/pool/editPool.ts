import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const editPool: MutationResolvers['editPool'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.debug('Editing pool', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  const poolResponse = await clients.rwaClient.getPool.post({
    id: input.id
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

  const response = await clients.rwaClient.editPool.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to edit pool:', response.error);
    throw new Error('Failed to edit pool');
  }

  const { data } = response;

  return data;
};
