import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createBusiness: MutationResolvers['createBusiness'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new business', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    permission: 'content'
  });

  const response = await clients.rwaClient.createBusiness.post({
    name: input.name,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    chainId: input.chainId,
    description: input.description || '',
    tags: input.tags || [],
  });

  if (response.error) {
    logger.error('Failed to create business:', response.error);
    throw new Error('Failed to create business');
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