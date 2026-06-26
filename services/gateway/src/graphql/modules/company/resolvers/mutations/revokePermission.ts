import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const revokePermission: MutationResolvers['revokePermission'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.debug('Revoking permission', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  const companyResponse = await services.cache.getCompany({
    id: input.companyId
  });

  if (companyResponse.error) {
    logger.error('Failed to get company details:', companyResponse.error);
    throw new AppError({ message: 'Failed to get company details', statusCode: 502, code: "BAD_GATEWAY" });
  }

  // Check if current user is the owner
  if (companyResponse.data.ownerId !== user.id) {
    logger.error('User is not the company owner', { userId: user.id, companyId: input.companyId });
    throw new AppError({ message: 'Only company owner can revoke permissions', statusCode: 403, code: "FORBIDDEN" });
  }

  const response = await clients.companyClient.revokePermission.post({
    id: input.id,
  });

  if (response.error) {
    logger.error('Failed to revoke permission:', response.error);
    throw new AppError({ message: 'Failed to revoke permission', statusCode: 502, code: "BAD_GATEWAY" });
  }

  await services.cache.resetCompanyCache(input.companyId)

  return response.data.id;
};
