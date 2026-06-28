import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const addMember: MutationResolvers['addMember'] = async (_parent, { input }, { services, clients, user }) => {
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
      code: 'UPSTREAM_ERROR',
    });
  }

  // Check if current user is the ownerId
  if (companyResponse.data.ownerId !== user.id) {
    throw new AppError({
      message: 'Only company owner can add members',
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
    });
  }

  const response = await clients.companyClient.addMember.post({
    companyId: input.companyId,
    userId: input.userId,
    name: input.name,
  });

  if (response.error) {
    throw new AppError({
      message: 'Failed to add member',
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
    });
  }

  await services.cache.resetCompanyCache(input.companyId);

  const { data } = response;

  return {
    id: data.id,
    userId: data.userId,
    name: data.name,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};
