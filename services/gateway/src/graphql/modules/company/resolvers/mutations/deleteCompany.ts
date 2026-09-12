import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const deleteCompany: MutationResolvers['deleteCompany'] = async (
  _parent,
  { id },
  { services, clients, user },
) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const companyResponse = await services.cache.getCompany({ id });

  if (companyResponse.error) {
    throw new AppError({
      message: 'Failed to get company details',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  // Check if current user is the owner
  if (companyResponse.data.ownerId !== user.id) {
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
    throw new AppError({
      message: 'Failed to delete company',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  await services.cache.resetCompanyCache(id);

  return response.data.id;
};
