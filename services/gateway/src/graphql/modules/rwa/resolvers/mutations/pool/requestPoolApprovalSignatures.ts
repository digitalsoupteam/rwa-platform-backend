import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../../generated/types';

export const requestPoolApprovalSignatures: MutationResolvers['requestPoolApprovalSignatures'] = async (
  _parent,
  { input },
  { services, clients, user },
) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const poolResponse = await clients.rwaClient.getPool.post({
    id: input.id,
  });

  if (poolResponse.error) {
    throw new AppError({
      message: 'Failed to get pool data',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const pool = poolResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: pool.ownerId,
    ownerType: pool.ownerType,
    permission: 'deploy',
  });

  const response = await clients.rwaClient.requestPoolApprovalSignatures.post({
    id: input.id,
    ownerWallet: input.ownerWallet,
    deployerWallet: input.deployerWallet,
    createPoolFeeRatio: input.createPoolFeeRatio,
  });

  if (response.error) {
    throw new AppError({
      message: 'Failed to request pool approval signatures',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;

  return {
    taskId: data.taskId,
  };
};