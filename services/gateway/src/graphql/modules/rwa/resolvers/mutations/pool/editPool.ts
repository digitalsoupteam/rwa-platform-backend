import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const editPool: MutationResolvers['editPool'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Editing pool', { input });

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
    permission: 'content'
  });

  const response = await clients.rwaClient.editPool.post({
    id: input.id,
    updateData: {
      chainId: input.updateData.chainId,
      name: input.updateData.name,
      entryFeePercent: input.updateData.entryFeePercent,
      exitFeePercent: input.updateData.exitFeePercent,
      expectedHoldAmount: input.updateData.expectedHoldAmount,
      expectedRwaAmount: input.updateData.expectedRwaAmount,
      rewardPercent: input.updateData.rewardPercent,
      entryPeriodStart: input.updateData.entryPeriodStart,
      entryPeriodExpired: input.updateData.entryPeriodExpired,
      completionPeriodExpired: input.updateData.completionPeriodExpired,
      awaitCompletionExpired: input.updateData.awaitCompletionExpired,
      floatingOutTranchesTimestamps: input.updateData.floatingOutTranchesTimestamps,
      fixedSell: input.updateData.fixedSell,
      allowEntryBurn: input.updateData.allowEntryBurn,
      priceImpactPercent: input.updateData.priceImpactPercent,
      outgoingTranches: input.updateData.outgoingTranches,
      incomingTranches: input.updateData.incomingTranches,
      description: input.updateData.description,
      tags: input.updateData.tags
    }
  });

  if (response.error) {
    logger.error('Failed to edit pool:', response.error);
    throw new Error('Failed to edit pool');
  }

  const { data } = response;

  return data;
};