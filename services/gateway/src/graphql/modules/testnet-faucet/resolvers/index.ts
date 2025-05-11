import { Resolvers } from '../../../generated/types';
import { getHistory } from './queries/getHistory';
import { getUnlockTime } from './queries/getUnlockTime';
import { requestGas } from './mutations/requestGas';
import { requestHold } from './mutations/requestHold';

export const testnetFaucetResolvers: Resolvers = {
  Query: {
    getHistory,
    getUnlockTime,
  },
  Mutation: {
    requestGas,
    requestHold,
  },
};