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

  if (!business.tokenAddress) {
    logger.error('Deploy business before');
    throw new Error('Deploy business before');
  }


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
    chainId: business.chainId,
    rwaAddress: business.tokenAddress,
    description: input.description,
    tags: input.tags,
    entryFeePercent: input.entryFeePercent,
    exitFeePercent: input.exitFeePercent,
    expectedHoldAmount: input.expectedHoldAmount,
    expectedRwaAmount: input.expectedRwaAmount,
    rewardPercent: input.rewardPercent,
    entryPeriodStart: input.entryPeriodStart,
    entryPeriodExpired: input.entryPeriodExpired,
    completionPeriodExpired: input.completionPeriodExpired,
    awaitCompletionExpired: input.awaitCompletionExpired,
    floatingOutTranchesTimestamps: input.floatingOutTranchesTimestamps,
    fixedSell: input.fixedSell,
    allowEntryBurn: input.allowEntryBurn,
    priceImpactPercent: input.priceImpactPercent,
    outgoingTranches: input.outgoingTranches,
    incomingTranches: input.incomingTranches,
  });

  if (response.error) {
    logger.error('Failed to create pool:', response.error);
    throw new Error('Failed to create pool');
  }

  const { data } = response;

  return data;
};