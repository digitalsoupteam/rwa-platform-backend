import { AuthenticationError } from '@shared/errors/app-errors';
import { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const createBusinessWithAI: MutationResolvers['createBusinessWithAI'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info('Creating new business with AI', { input });

  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    permission: 'content'
  });

  const response = await clients.rwaClient.createBusinessWithAI.post({
    description: input.description,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    chainId: input.chainId,
  });

  if (response.error) {
    logger.error('Failed to create business with AI:', response.error);
    throw new Error('Failed to create business with AI');
  }

  const { data } = response;

  return data;
};