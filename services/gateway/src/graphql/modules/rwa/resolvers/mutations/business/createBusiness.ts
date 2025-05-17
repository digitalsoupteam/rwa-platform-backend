import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createBusiness: MutationResolvers['createBusiness'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new business', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    permission: 'content'
  });

  const response = await clients.rwaClient.createBusiness.post({
    name: input.name,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    chainId: input.chainId,
    description: input.description,
    tags: input.tags,
  });

  if (response.error) {
    logger.error('Failed to create business:', response.error);
    throw new Error('Failed to create business');
  }

  const { data } = response;

  return data;
};