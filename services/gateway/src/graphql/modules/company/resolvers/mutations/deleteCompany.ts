import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const deleteCompany: MutationResolvers['deleteCompany'] = async (
  _parent,
  { id },
  { services, clients, user }
) => {
  logger.info('Deleting company', { id });

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  const companyResponse = await services.cache.getCompany({ id });

  if (companyResponse.error) {
    logger.error('Failed to get company details:', companyResponse.error);
    throw new Error('Failed to get company details');
  }

  // Check if current user is the owner
  if (companyResponse.data.ownerId !== user.id) {
    logger.error('User is not the company owner', { userId: user.id, companyId: id });
    throw new Error('Only company owner can delete company');
  }

  const response = await clients.companyClient.deleteCompany.post({
    id,
  });

  if (response.error) {
    logger.error('Failed to delete company:', response.error);
    throw new Error('Failed to delete company');
  }
  
  await services.cache.resetCompanyCache(id)

  return response.data.id;
};