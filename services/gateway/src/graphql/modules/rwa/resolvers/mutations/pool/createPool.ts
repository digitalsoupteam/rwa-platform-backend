import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createPool: MutationResolvers['createPool'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new pool', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get business first to check permissions
  const businessResponse = await clients.rwaClient.getBusiness.post({
    id: input.businessId
  });

  if (businessResponse.error) {
    logger.error('Failed to get business:', businessResponse.error);
    throw new Error('Failed to get business data');
  }

  const business = businessResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: business.ownerId,
    ownerType: business.ownerType,
    permission: 'content'
  });

  const response = await clients.rwaClient.createPool.post({
    name: input.name,
    ownerId: business.ownerId,
    ownerType: business.ownerType,
    businessId: input.businessId,
    chainId: input.chainId,
    rwaAddress: input.rwaAddress,
  });

  if (response.error) {
    logger.error('Failed to create pool:', response.error);
    throw new Error('Failed to create pool');
  }

  const { data } = response;

  return {
    id: data.id,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    ownerWallet: data.ownerWallet,
    name: data.name,
    businessId: data.businessId,
    description: data.description,
    chainId: data.chainId,
    tags: data.tags,
    riskScore: data.riskScore,

    // Contract Addresses
    rwaAddress: data.rwaAddress,
    poolAddress: data.poolAddress,
    holdToken: data.holdToken,
    tokenId: data.tokenId,

    // Pool Configuration
    entryFeePercent: data.entryFeePercent,
    exitFeePercent: data.exitFeePercent,
    expectedHoldAmount: data.expectedHoldAmount,
    expectedRwaAmount: data.expectedRwaAmount,
    expectedBonusAmount: data.expectedBonusAmount,
    rewardPercent: data.rewardPercent,
    priceImpactPercent: data.priceImpactPercent,
    liquidityCoefficient: data.liquidityCoefficient,

    // Pool Flags
    awaitCompletionExpired: data.awaitCompletionExpired,
    floatingOutTranchesTimestamps: data.floatingOutTranchesTimestamps,
    fixedSell: data.fixedSell,
    allowEntryBurn: data.allowEntryBurn,
    paused: data.paused,

    // Time Periods
    entryPeriodStart: data.entryPeriodStart,
    entryPeriodExpired: data.entryPeriodExpired,
    completionPeriodExpired: data.completionPeriodExpired,
    floatingTimestampOffset: data.floatingTimestampOffset,
    fullReturnTimestamp: data.fullReturnTimestamp,

    // Pool State
    k: data.k,
    realHoldReserve: data.realHoldReserve,
    virtualHoldReserve: data.virtualHoldReserve,
    virtualRwaReserve: data.virtualRwaReserve,
    isTargetReached: data.isTargetReached,
    isFullyReturned: data.isFullyReturned,

    // Amounts
    totalClaimedAmount: data.totalClaimedAmount,
    totalReturnedAmount: data.totalReturnedAmount,
    awaitingBonusAmount: data.awaitingBonusAmount,
    awaitingRwaAmount: data.awaitingRwaAmount,
    outgoingTranchesBalance: data.outgoingTranchesBalance,

    // Tranches
    outgoingTranches: data.outgoingTranches,
    incomingTranches: data.incomingTranches,
    lastCompletedIncomingTranche: data.lastCompletedIncomingTranche,

    // Approval
    approvalSignaturesTaskId: data.approvalSignaturesTaskId,
    approvalSignaturesTaskExpired: data.approvalSignaturesTaskExpired,

    // Timestamps
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};