import { AppError } from '@shared/errors/app-errors';
import type { QueryResolvers } from '../../../../generated/types';

export const getCompany: QueryResolvers['getCompany'] = async (_parent, { id }, { services }) => {
  const response = await services.cache.getCompany({ id });

  if (response.error) {
    throw new AppError({ message: 'Failed to get company', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const { data } = response;

  return data;
};
