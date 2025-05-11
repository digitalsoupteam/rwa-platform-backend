import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const rejectApprovalSignatures: MutationResolvers['rejectApprovalSignatures'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Rejecting business approval signatures', { id });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  const businessResponse = await clients.rwaClient.getBusiness.post({
    id
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

  const response = await clients.rwaClient.rejectBusinessApprovalSignatures.post({
    id
  });

  if (response.error) {
    logger.error('Failed to reject business approval signatures:', response.error);
    throw new Error('Failed to reject business approval signatures');
  }

  return true;
};