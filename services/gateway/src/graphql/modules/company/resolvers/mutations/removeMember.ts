import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const removeMember: MutationResolvers['removeMember'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.debug('Removing member', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  const companyResponse = await services.cache.getCompany({
    id: input.companyId
  });

  if (companyResponse.error) {
    logger.error('Failed to get company details:', companyResponse.error);
    throw new Error('Failed to get company details');
  }

  // Check if current user is the owner
  if (companyResponse.data.ownerId !== user.id) {
    logger.error('User is not the company owner', { userId: user.id, companyId: input.companyId });
    throw new Error('Only company owner can remove members');
  }

  const response = await clients.companyClient.removeMember.post({
    id: input.id,
  });

  if (response.error) {
    logger.error('Failed to remove member:', response.error);
    throw new Error('Failed to remove member');
  }

  await services.cache.resetCompanyCache(input.companyId)

  return response.data.id;
};
