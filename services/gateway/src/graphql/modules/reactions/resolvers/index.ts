import { Resolvers } from '../../../generated/types';
import { getEntityReactions } from './queries/getEntityReactions';
import { setReaction } from './mutations/setReaction';
import { resetReaction } from './mutations/resetReaction';

export const reactionsResolvers: Resolvers = {
  Query: {
    getEntityReactions,
  },
  Mutation: {
    setReaction,
    resetReaction,
  },
};