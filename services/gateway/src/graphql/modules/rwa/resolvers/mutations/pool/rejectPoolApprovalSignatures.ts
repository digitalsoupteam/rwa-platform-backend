import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const rejectPoolApprovalSignatures: MutationResolvers['rejectPoolApprovalSignatures'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Rejecting pool approval signatures', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
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

  const response = await clients.rwaClient.rejectPoolApprovalSignatures.post({
    id
  });

  if (response.error) {
    logger.error('Failed to reject pool approval signatures:', response.error);
    throw new Error('Failed to reject pool approval signatures');
  }

  return true;
};