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
    type: input.type,
    chainId: input.chainId,
    businessId: input.businessId,
    rwaAddress: input.rwaAddress,
    expectedHoldAmount: input.expectedHoldAmount,
    rewardPercent: input.rewardPercent,
    description: input.description,
    entryPeriodDuration: input.entryPeriodDuration,
    completionPeriodDuration: input.completionPeriodDuration,
    speculativeSpecificFields: input.speculativeSpecificFields,
    ownerId: business.ownerId,
    ownerType: business.ownerType,
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
    name: data.name,
    type: data.type,
    businessId: data.businessId,
    rwaAddress: data.rwaAddress,
    poolAddress: data.poolAddress,
    tokenId: data.tokenId,
    holdToken: data.holdToken,
    entryFeePercent: data.entryFeePercent,
    exitFeePercent: data.exitFeePercent,
    expectedHoldAmount: data.expectedHoldAmount,
    expectedRwaAmount: data.expectedRwaAmount,
    rewardPercent: data.rewardPercent,
    entryPeriodExpired: data.entryPeriodExpired,
    completionPeriodExpired: data.completionPeriodExpired,
    expectedReturnAmount: data.expectedReturnAmount,
    accumulatedHoldAmount: data.accumulatedHoldAmount,
    accumulatedRwaAmount: data.accumulatedRwaAmount,
    isTargetReached: data.isTargetReached,
    isFullyReturned: data.isFullyReturned,
    returnedAmount: data.returnedAmount,
    paused: data.paused,
    allocatedHoldAmount: data.allocatedHoldAmount,
    availableReturnBalance: data.availableReturnBalance,
    awaitingRwaAmount: data.awaitingRwaAmount,
    description: data.description,
    chainId: data.chainId,
    tags: data.tags,
    riskScore: data.riskScore,
    approvalSignaturesTaskId: data.approvalSignaturesTaskId,
    approvalSignaturesTaskExpired: data.approvalSignaturesTaskExpired,
    entryPeriodDuration: data.entryPeriodDuration,
    completionPeriodDuration: data.completionPeriodDuration,
    stableSpecificFields: data.stableSpecificFields,
    speculativeSpecificFields: data.speculativeSpecificFields,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};