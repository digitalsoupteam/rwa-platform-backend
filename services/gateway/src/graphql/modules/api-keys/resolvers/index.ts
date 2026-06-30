import type { Resolvers } from '../../../generated/types';
import { createApiKey } from './mutations/createApiKey';
import { updateApiKey } from './mutations/updateApiKey';
import { deleteApiKey } from './mutations/deleteApiKey';
import { getApiKeys } from './queries/getApiKeys';
import { getApiKey } from './queries/getApiKey';

export const apiKeysResolvers: Resolvers = {
  Query: {
    getApiKeys,
    getApiKey,
  },
  Mutation: {
    createApiKey,
    updateApiKey,
    deleteApiKey,
  },
};
