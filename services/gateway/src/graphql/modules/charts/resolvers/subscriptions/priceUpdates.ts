import { SubscriptionResolvers, PriceUpdateEvent } from '../../../../generated/types';
import { pipe, map } from 'graphql-yoga';
import { logger } from '@shared/monitoring/src/logger';
import { RedisEvent } from '../../../../context/types';

export const priceUpdates: SubscriptionResolvers['priceUpdates'] = {
  subscribe: (_parent, { poolAddress }, { pubSub }) => {
    logger.debug(`Subscribing to price updates for pool ${poolAddress}`);
    
    return pipe(
      pubSub.subscribe(`charts:price:${poolAddress}`),
      map((event: RedisEvent) => ({ priceUpdates: event.payload }))
    );
  }
};