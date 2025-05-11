import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getPools: QueryResolvers['getPools'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting pools list', { input });

  const response = await clients.rwaClient.getPools.post({
    filter: input.filter,
    sort: input.sort,
    limit: input.limit,
    offset: input.offset,
  });

  if (response.error) {
    logger.error('Failed to get pools:', response.error);
    throw new Error('Failed to get pools');
  }

  const { data } = response;

  return data.map(pool => ({
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
  }));
};