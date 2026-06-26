import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const deleteCompany: MutationResolvers['deleteCompany'] = async (
  _parent,
  { id },
  { services, clients, user },
) => {
  logger.debug('Deleting company', { id });

  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const companyResponse = await services.cache.getCompany({ id });

  if (companyResponse.error) {
    logger.error('Failed to get company details:', companyResponse.error);
    throw new AppError({
      message: 'Failed to get company details',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  // Check if current user is the owner
  if (companyResponse.data.ownerId !== user.id) {
    logger.error('User is not the company owner', { userId: user.id, companyId: id });
    throw new AppError({
      message: 'Only company owner can delete company',
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  const response = await clients.companyClient.deleteCompany.post({
    id,
  });

  if (response.error) {
    logger.error('Failed to delete company:', response.error);
    throw new AppError({
      message: 'Failed to delete company',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  await services.cache.resetCompanyCache(id);

  return response.data.id;
};
