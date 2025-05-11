import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const requestPoolApprovalSignatures: MutationResolvers['requestPoolApprovalSignatures'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Requesting pool approval signatures', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
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
    permission: 'deploy'
  });

  const ownerWallet = await services.ownership.getOwnerWallet({
    user,
    ownerId: pool.ownerId,
    ownerType: pool.ownerType,
  })

  const response = await clients.rwaClient.requestPoolApprovalSignatures.post({
    id: input.id,
    ownerWallet,
    deployerWallet: user.wallet,
    createPoolFeeRatio: input.createPoolFeeRatio,
  });

  if (response.error) {
    logger.error('Failed to request pool approval signatures:', response.error);
    throw new Error('Failed to request pool approval signatures');
  }

  const { data } = response;

  return {
    taskId: data.taskId,
  };
};