import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createCompany: MutationResolvers['createCompany'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new company', { input });

  if (!user) {
    throw new AuthenticationError("Authentication required");
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
    throw new Error('Failed to create company');
  }

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    ownerId: data.ownerId,
    country: data.country ?? null,
    socials: data.socials ?? [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};
