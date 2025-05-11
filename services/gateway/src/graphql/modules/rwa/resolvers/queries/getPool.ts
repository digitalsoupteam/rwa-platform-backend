import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getPool: QueryResolvers['getPool'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting pool by id', { id });

  const response = await clients.rwaClient.getPool.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get pool:', response.error);
    throw new Error('Failed to get pool');
  }

  const pool = response.data;

  return {
    id: pool.id,
    ownerId: pool.ownerId,
    ownerType: pool.ownerType,
    name: pool.name,
    type: pool.type,
    businessId: pool.businessId,
    rwaAddress: pool.rwaAddress,
    poolAddress: pool.poolAddress,
    tokenId: pool.tokenId,
    holdToken: pool.holdToken,
    entryFeePercent: pool.entryFeePercent,
    exitFeePercent: pool.exitFeePercent,
    expectedHoldAmount: pool.expectedHoldAmount,
    expectedRwaAmount: pool.expectedRwaAmount,
    rewardPercent: pool.rewardPercent,
    entryPeriodExpired: pool.entryPeriodExpired,
    completionPeriodExpired: pool.completionPeriodExpired,
    expectedReturnAmount: pool.expectedReturnAmount,
    accumulatedHoldAmount: pool.accumulatedHoldAmount,
    accumulatedRwaAmount: pool.accumulatedRwaAmount,
    isTargetReached: pool.isTargetReached,
    isFullyReturned: pool.isFullyReturned,
    returnedAmount: pool.returnedAmount,
    paused: pool.paused,
    allocatedHoldAmount: pool.allocatedHoldAmount,
    availableReturnBalance: pool.availableReturnBalance,
    awaitingRwaAmount: pool.awaitingRwaAmount,
    description: pool.description,
    chainId: pool.chainId,
    tags: pool.tags,
    riskScore: pool.riskScore,
    approvalSignaturesTaskId: pool.approvalSignaturesTaskId,
    approvalSignaturesTaskExpired: pool.approvalSignaturesTaskExpired,
    entryPeriodDuration: pool.entryPeriodDuration,
    completionPeriodDuration: pool.completionPeriodDuration,
    stableSpecificFields: pool.stableSpecificFields,
    speculativeSpecificFields: pool.speculativeSpecificFields,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
  };
};