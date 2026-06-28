import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const grantPermission: MutationResolvers['grantPermission'] = async (
  _parent,
  { input },
  { services, clients, user },
) => {
  if (!user) {
    throw new AppError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }

  const companyResponse = await services.cache.getCompany({
    id: input.companyId,
  });

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
      message: 'Only company owner can grant permissions',
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  const response = await clients.companyClient.grantPermission.post({
    companyId: input.companyId,
    memberId: input.memberId,
    userId: input.userId,
    permission: input.permission,
    entity: input.entity,
  });

  if (response.error) {
    throw new AppError({
      message: 'Failed to grant permission',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  await services.cache.resetCompanyCache(input.companyId);

  const { data } = response;

  return {
    id: data.id,
    permission: data.permission,
    entity: data.entity,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};
