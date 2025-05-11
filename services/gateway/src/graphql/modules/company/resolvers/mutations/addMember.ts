import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const addMember: MutationResolvers['addMember'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Adding member to company', { input });

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

  // Check if current user is the ownerId
  if (companyResponse.data.ownerId !== user.id) {
    logger.error('User is not the company ownerId', { userId: user.id, companyId: input.companyId });
    throw new Error('Only company owner can add members');
  }

  const response = await clients.companyClient.addMember.post({
    companyId: input.companyId,
    userId: input.userId,
    name: input.name,
  });

  if (response.error) {
    logger.error('Failed to add member:', response.error);
    throw new Error('Failed to add member');
  }

  await services.cache.resetCompanyCache(input.companyId)

  const { data } = response;

  return {
    id: data.id,
    userId: data.userId,
    name: data.name,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};