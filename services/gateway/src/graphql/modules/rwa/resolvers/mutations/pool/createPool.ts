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
    ...input,
    ownerId: business.ownerId,
    ownerType: business.ownerType,
    chainId: business.chainId,
    rwaAddress: business.tokenAddress
  });

  if (response.error) {
    logger.error('Failed to create pool:', response.error);
    throw new Error('Failed to create pool');
  }

  const { data } = response;

  return data;
};