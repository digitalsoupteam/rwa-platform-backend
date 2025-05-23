import { SubscriptionResolvers, PriceUpdateEvent } from '../../../../generated/types';
import { pipe, filter } from 'graphql-yoga';
import { logger } from '@shared/monitoring/src/logger';

export const countdown: SubscriptionResolvers['countdown'] = {
  subscribe: async function* (_, { from }) {
    for (let i = from; i >= 0; i--) {
      await new Promise(r => setTimeout(r, 60000))
      yield { countdown: i }
    }
  },
};

