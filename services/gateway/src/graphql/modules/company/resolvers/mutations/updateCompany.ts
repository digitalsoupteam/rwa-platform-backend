import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const updateCompany: MutationResolvers['updateCompany'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Updating company', { input });

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  const companyResponse = await services.cache.getCompany({
    id: input.id
  });

  if (companyResponse.error) {
    logger.error('Failed to get company details:', companyResponse.error);
    throw new Error('Failed to get company details');
  }

  // Check if current user is the owner
  if (companyResponse.data.ownerId !== user.id) {
    logger.error('User is not the company owner', { userId: user.id, companyId: input.id });
    throw new Error('Only company owner can update company');
  }

  const response = await clients.companyClient.updateCompany.post({
    id: input.id,
    updateData: input.updateData,
  });

  if (response.error) {
    logger.error('Failed to update company:', response.error);
    throw new Error('Failed to update company');
  }

  await services.cache.resetCompanyCache(input.id)

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    ownerId: data.ownerId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};