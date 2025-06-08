import { SubscriptionResolvers } from '../../../../generated/types';
import { pipe, map } from 'graphql-yoga';
import { logger } from '@shared/monitoring/src/logger';
import { RedisEvent } from '../../../../context/types';



export const poolDeployed: SubscriptionResolvers['poolDeployed'] = {
  subscribe: (_parent, _args, { pubSub }) => {
    logger.debug('Subscribing to pool deployed events');
    
    return pipe(
      pubSub.subscribe('pool:deployed'),
      map((event: RedisEvent) => ({ poolDeployed: event.payload }))
    );
  }
};