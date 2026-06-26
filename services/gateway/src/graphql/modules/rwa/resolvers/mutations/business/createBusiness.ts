import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const createBusiness: MutationResolvers['createBusiness'] = async (
  _parent,
  { input },
  { services, clients, user },
) => {
  logger.debug('Creating new business', { input });

  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  services.validation.validateCountry(input.country);
  services.validation.validateSocials(input.socials as any);

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    permission: 'content',
  });

  const response = await clients.rwaClient.createBusiness.post({
    name: input.name,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    chainId: input.chainId,
    description: input.description,
    tags: input.tags,
    image: input.image ?? undefined,
    country: input.country ?? undefined,
    businessType: input.businessType ?? undefined,
    socials: input.socials ?? undefined,
  });

  if (response.error) {
    logger.error('Failed to create business:', response.error);
    throw new AppError({
      message: 'Failed to create business',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;

  return data;
};
