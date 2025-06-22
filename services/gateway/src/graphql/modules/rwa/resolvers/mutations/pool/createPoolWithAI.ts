import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createPoolWithAI: MutationResolvers['createPoolWithAI'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new pool with AI', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  // Get business first to check permissions and get required data
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

  const response = await clients.rwaClient.createPoolWithAI.post({
    description: input.description,
    ownerId: business.ownerId,
    ownerType: business.ownerType,
    businessId: input.businessId,
    chainId: business.chainId,
    rwaAddress: business.tokenAddress
  });

  if (response.error) {
    logger.error('Failed to create pool with AI:', response.error);
    throw new Error('Failed to create pool with AI');
  }

  const { data } = response;

  return data;
};