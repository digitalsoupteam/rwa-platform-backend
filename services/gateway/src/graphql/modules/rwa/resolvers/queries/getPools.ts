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
    ownerWallet: pool.ownerWallet,
    name: pool.name,
    businessId: pool.businessId,
    description: pool.description,
    chainId: pool.chainId,
    tags: pool.tags,
    riskScore: pool.riskScore,

    // Contract Addresses
    rwaAddress: pool.rwaAddress,
    poolAddress: pool.poolAddress,
    holdToken: pool.holdToken,
    tokenId: pool.tokenId,

    // Pool Configuration
    entryFeePercent: pool.entryFeePercent,
    exitFeePercent: pool.exitFeePercent,
    expectedHoldAmount: pool.expectedHoldAmount,
    expectedRwaAmount: pool.expectedRwaAmount,
    expectedBonusAmount: pool.expectedBonusAmount,
    rewardPercent: pool.rewardPercent,
    priceImpactPercent: pool.priceImpactPercent,
    liquidityCoefficient: pool.liquidityCoefficient,

    // Pool Flags
    awaitCompletionExpired: pool.awaitCompletionExpired,
    floatingOutTranchesTimestamps: pool.floatingOutTranchesTimestamps,
    fixedSell: pool.fixedSell,
    allowEntryBurn: pool.allowEntryBurn,
    paused: pool.paused,

    // Time Periods
    entryPeriodStart: pool.entryPeriodStart,
    entryPeriodExpired: pool.entryPeriodExpired,
    completionPeriodExpired: pool.completionPeriodExpired,
    floatingTimestampOffset: pool.floatingTimestampOffset,
    fullReturnTimestamp: pool.fullReturnTimestamp,

    // Pool State
    k: pool.k,
    realHoldReserve: pool.realHoldReserve,
    virtualHoldReserve: pool.virtualHoldReserve,
    virtualRwaReserve: pool.virtualRwaReserve,
    isTargetReached: pool.isTargetReached,
    isFullyReturned: pool.isFullyReturned,

    // Amounts
    totalClaimedAmount: pool.totalClaimedAmount,
    totalReturnedAmount: pool.totalReturnedAmount,
    awaitingBonusAmount: pool.awaitingBonusAmount,
    awaitingRwaAmount: pool.awaitingRwaAmount,
    outgoingTranchesBalance: pool.outgoingTranchesBalance,

    // Tranches
    outgoingTranches: pool.outgoingTranches,
    incomingTranches: pool.incomingTranches,
    lastCompletedIncomingTranche: pool.lastCompletedIncomingTranche,

    // Approval
    approvalSignaturesTaskId: pool.approvalSignaturesTaskId,
    approvalSignaturesTaskExpired: pool.approvalSignaturesTaskExpired,

    // Timestamps
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
  }));
};