import { PubSub } from 'graphql-subscriptions';

export const pubsub = new PubSub();

export const EVENTS = {
  KYC_STATUS_UPDATED: 'KYC_STATUS_UPDATED',
} as const;
