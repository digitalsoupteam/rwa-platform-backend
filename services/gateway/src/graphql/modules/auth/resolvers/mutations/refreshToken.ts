import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';

export const refreshToken: MutationResolvers['refreshToken'] = async (_parent, { input }, { clients }) => {
  const response = await clients.authClient.refreshToken.post({
    refreshToken: input.refreshToken,
  });

  if (response.error) {
    throw new AppError({
      message: 'Failed to refresh token',
      statusCode: 502,
      code: 'BAD_GATEWAY',
    });
  }

  const { data } = response;
  return data;
};
