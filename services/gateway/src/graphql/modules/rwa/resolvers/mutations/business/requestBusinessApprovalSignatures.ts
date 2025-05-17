import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const requestBusinessApprovalSignatures: MutationResolvers['requestBusinessApprovalSignatures'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Requesting business approval signatures', { input });

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
    permission: 'deploy'
  });

  const response = await clients.rwaClient.requestBusinessApprovalSignatures.post({
    id: input.id,
    ownerWallet: input.ownerWallet,
    deployerWallet: input.deployerWallet,
    createRWAFee: input.createRWAFee,
  });

  if (response.error) {
    logger.error('Failed to request business approval signatures:', response.error);
    throw new Error('Failed to request business approval signatures');
  }

  const { data } = response;

  return data;
};