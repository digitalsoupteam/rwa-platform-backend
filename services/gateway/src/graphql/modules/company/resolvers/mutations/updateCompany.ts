import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const updateCompany: MutationResolvers['updateCompany'] = async (
  _parent,
  { input },
  { services, clients, user },
) => {
  logger.debug('Updating company', { input });

  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  services.validation.validateCountry(input.updateData.country);
  services.validation.validateSocials(input.updateData.socials as any);

  const companyResponse = await services.cache.getCompany({
    id: input.id,
  });

  if (companyResponse.error) {
    logger.error('Failed to get company details:', companyResponse.error);
    throw new AppError({
      message: 'Failed to get company details',
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
    });
  }

  // Check if current user is the owner
  if (companyResponse.data.ownerId !== user.id) {
    logger.error('User is not the company owner', { userId: user.id, companyId: input.id });
    throw new AppError({
      message: 'Only company owner can update company',
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
    });
  }

  const response = await clients.companyClient.updateCompany.post({
    id: input.id,
    updateData: {
      name: input.updateData.name,
      description: input.updateData.description,
      country: input.updateData.country,
      socials: input.updateData.socials,
    },
  });

  if (response.error) {
    logger.error('Failed to update company:', response.error);
    throw new AppError({
      message: 'Failed to update company',
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
    });
  }

  await services.cache.resetCompanyCache(input.id);

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    ownerId: data.ownerId,
    country: data.country,
    socials: data.socials ?? [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};
