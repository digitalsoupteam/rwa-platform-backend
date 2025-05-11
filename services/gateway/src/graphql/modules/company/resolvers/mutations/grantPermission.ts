import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const grantPermission: MutationResolvers['grantPermission'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Granting permission', { input });

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  const companyResponse = await services.cache.getCompany({
    id: input.companyId
  });

  if (companyResponse.error) {
    logger.error('Failed to get company details:', companyResponse.error);
    throw new Error('Failed to get company details');
  }

  // Check if current user is the owner
  if (companyResponse.data.ownerId !== user.id) {
    logger.error('User is not the company owner', { userId: user.id, companyId: input.companyId });
    throw new Error('Only company owner can grant permissions');
  }

  const response = await clients.companyClient.grantPermission.post({
    companyId: input.companyId,
    memberId: input.memberId,
    userId: input.userId,
    permission: input.permission,
    entity: input.entity,
  });

  if (response.error) {
    logger.error('Failed to grant permission:', response.error);
    throw new Error('Failed to grant permission');
  }

  await services.cache.resetCompanyCache(input.companyId)
  
  const { data } = response;

  return {
    id: data.id,
    permission: data.permission,
    entity: data.entity,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};