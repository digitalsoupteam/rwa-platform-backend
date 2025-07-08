import { Resolvers } from '../../../generated/types';
import { authenticate } from './mutations/authenticate';
import { refreshToken } from './mutations/refreshToken';
import { revokeTokens } from './mutations/revokeTokens';
import { getUserTokens } from './queries/getUserTokens';

export const authResolvers: Resolvers = {
  Query: {
    getUserTokens,
  },
  Mutation: {
    authenticate,
    refreshToken,
    revokeTokens,
  },
};