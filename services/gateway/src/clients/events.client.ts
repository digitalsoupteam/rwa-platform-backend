import { createPubSub } from 'graphql-yoga';
import { createRedisEventTarget } from '@graphql-yoga/redis-event-target';
import Redis from 'ioredis';
import { CONFIG } from "../config";
import { logger } from "@shared/monitoring/src/logger";

import { RedisWithTracing } from "@shared/monitoring/src/redis";

const publishClient =  new RedisWithTracing(CONFIG.REDIS.URL);
const subscribeClient = new RedisWithTracing(CONFIG.REDIS.URL);


publishClient.on('connect', () => logger.info('Redis publisher connected'));
publishClient.on('error', (err) => logger.error('Redis publisher error:', err));
subscribeClient.on('connect', () => logger.info('Redis subscriber connected'));
subscribeClient.on('error', (err) => logger.error('Redis subscriber error:', err));


export interface PriceUpdatePayload {
  poolAddress: string;
  timestamp: number;
  price: string;
  realHoldReserve: string;
  virtualHoldReserve: string;
  virtualRwaReserve: string;
}

export interface TransactionUpdatePayload {
  poolAddress: string;
  timestamp: number;
  transactionType: string;
  userAddress: string;
  rwaAmount: string;
  holdAmount: string;
  bonusAmount: string;
  holdFee: string;
  bonusFee: string;
}

export const pubSub = createPubSub({
  eventTarget: createRedisEventTarget({
    publishClient,
    subscribeClient
  })
});