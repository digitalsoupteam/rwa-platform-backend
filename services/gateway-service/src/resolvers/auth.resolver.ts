import { logger, metrics } from '@rwa-platform/shared/src';


export const authResolver = {
  Query: {
    me: async (_: any, __: any, { auth }: any) => {
      try {
        const decoded = await auth();
        metrics.increment('gateway.query.me.success');
        return {
          address: decoded.address
        };
      } catch (error: any) {
        logger.error(`Me query failed: ${error.message}`);
        metrics.increment('gateway.query.me.failure');
        throw error;
      }
    }
  },

  Mutation: {
    getNonce: async (_: any, { address }: any, { dataSources }: any) => {
      try {
        const nonce = await dataSources.authAPI.getNonce(address);
        metrics.increment('gateway.mutation.getNonce.success');
        return nonce;
      } catch (error: any) {
        logger.error(`GetNonce mutation failed: ${error.message}`);
        metrics.increment('gateway.mutation.getNonce.failure');
        throw error;
      }
    },

    authenticate: async (_: any, { address, signature }: any, { dataSources }: any) => {
      try {
        const token = await dataSources.authAPI.verifySignature(address, signature);
        metrics.increment('gateway.mutation.authenticate.success');
        return {
          token,
          address
        };
      } catch (error: any) {
        logger.error(`Authentication mutation failed: ${error.message}`);
        metrics.increment('gateway.mutation.authenticate.failure');
        throw error;
      }
    }
  }
};
