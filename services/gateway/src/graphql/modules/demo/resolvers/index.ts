
import { Resolvers } from '../../../generated/types';
import { countdown } from './subscriptions/countdown';

export const demoResolvers: Resolvers = {
  Subscription: {
    countdown,
  },
};