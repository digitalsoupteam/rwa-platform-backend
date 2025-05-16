import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const editBusiness: MutationResolvers['editBusiness'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Editing business', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get business first to check permissions
  const businessResponse = await clients.rwaClient.getBusiness.post({
    id: input.id
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

  const response = await clients.rwaClient.editBusiness.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to edit business:', response.error);
    throw new Error('Failed to edit business');
  }

  const { data } = response;

  return {
    id: data.id,
    chainId: data.chainId,
    name: data.name,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    ownerWallet: data.ownerWallet,
    tokenAddress: data.tokenAddress,
    description: data.description,
    tags: data.tags,
    riskScore: data.riskScore,
    image: data.image,
    approvalSignaturesTaskId: data.approvalSignaturesTaskId,
    approvalSignaturesTaskExpired: data.approvalSignaturesTaskExpired,
    paused: data.paused,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};