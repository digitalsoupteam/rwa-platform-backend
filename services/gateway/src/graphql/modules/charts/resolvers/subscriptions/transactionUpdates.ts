import { SubscriptionResolvers, TransactionEvent } from '../../../../generated/types';
import { pipe, map } from 'graphql-yoga';
import { logger } from '@shared/monitoring/src/logger';

interface RedisEvent {
  type: string;
  payload: TransactionEvent;
  metadata: {
    timestamp: number;
    service: string;
    version: string;
  };
}

export const transactionUpdates: SubscriptionResolvers['transactionUpdates'] = {
  subscribe: (_parent, { poolAddress }, {pubSub}) => {
    logger.debug(`Subscribing to transaction updates for pool ${poolAddress}`);
    
    return pipe(
      pubSub.subscribe(`charts:transactions:${poolAddress}`),
      map((event: RedisEvent) => ({ transactionUpdates: event.payload }))
    );
  }
};