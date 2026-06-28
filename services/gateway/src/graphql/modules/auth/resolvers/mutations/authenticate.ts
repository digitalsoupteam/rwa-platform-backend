import { AppError } from '@shared/errors/app-errors';
import type { MutationResolvers } from '../../../../generated/types';
import { ethers } from 'ethers';

export const authenticate: MutationResolvers['authenticate'] = async (_parent, { input }, { clients }) => {
  const authenticateResponse = await clients.authClient.authenticate.post({
    wallet: ethers.getAddress(input.wallet),
    signature: input.signature,
    timestamp: input.timestamp,
  });

  if (authenticateResponse.error) {
    throw new AppError({ message: 'Failed to authenticate', statusCode: 502, code: 'BAD_GATEWAY' });
  }

  const { data } = authenticateResponse;
  const result = {
    userId: data.userId,
    wallet: data.wallet,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };

  return result;
};
