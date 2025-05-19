import { Resolvers } from '../../../generated/types';
import { getRawPriceData } from './queries/getRawPriceData';
import { getOhlcPriceData } from './queries/getOhlcPriceData';

export const chartsResolvers: Resolvers = {
  Query: {
    getRawPriceData,
    getOhlcPriceData,
  },
};