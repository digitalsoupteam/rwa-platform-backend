import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const createCompany: MutationResolvers['createCompany'] = async (
  _parent,
  { input },
  { services, clients, user },
) => {
  logger.debug('Creating new company', { input });

  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  services.validation.validateCountry(input.country);
  services.validation.validateSocials(input.socials as any);

  const response = await clients.companyClient.createCompany.post({
    name: input.name,
    description: input.description,
    ownerId: user.id,
    country: input.country ?? undefined,
    socials: input.socials ?? undefined,
  });

  if (response.error) {
    logger.error('Failed to create company:', response.error);
    throw new AppError({
      message: 'Failed to create company',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

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
