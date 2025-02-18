import { logger, metrics } from '@rwa-platform/shared/src';
import { withFilter } from 'graphql-subscriptions';
import { pubsub, EVENTS } from '../pubsub';

export const kycResolver = {
  Query: {
    kycStatus: async (_: any, __: any, context: any) => {
      try {
        const { address } = await context.auth();
        return await context.dataSources.kycAPI.getStatus(address);
      } catch (error: any) {
        logger.error(`KYC status query failed: ${error.message}`);
        metrics.increment('gateway.query.kycStatus.failure');
        throw error;
      }
    },
  },

  Mutation: {
    initiateKYC: async (_: any, { provider, data }: any, context: any) => {
      try {
        const { address } = await context.auth();
        const result = await context.dataSources.kycAPI.initiateKYC(address, provider, data);
        metrics.increment('gateway.mutation.initiateKYC.success');
        return result;
      } catch (error: any) {
        logger.error(`KYC initiation failed: ${error.message}`);
        metrics.increment('gateway.mutation.initiateKYC.failure');
        throw error;
      }
    },
  },

  Subscription: {
    kycStatusUpdated: {
      subscribe: withFilter(
        () => (pubsub as any).asyncIterator(EVENTS.KYC_STATUS_UPDATED),
        async (payload: any, _: any, context: any) => {
          const { address } = await context.auth();
          return payload.kycStatusUpdated.userId === address;
        }
      ),
    },
  },
};
