import { Resolvers } from '../../../generated/types';
import { authenticate } from './mutations/authenticate';
import { refreshToken } from './mutations/refreshToken';

export const authResolvers: Resolvers = {
  Mutation: {
    authenticate,
    refreshToken,
  },
};