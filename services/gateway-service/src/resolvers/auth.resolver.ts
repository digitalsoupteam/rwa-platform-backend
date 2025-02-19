import { logger, metrics } from '@rwa-platform/shared/src';
import { AuthAPI } from 'src/datasources/auth.api';

interface Context {
  dataSources: {
    authAPI: AuthAPI;
  };
  auth: () => Promise<{ address: string }>;
}
export interface SignatureRequest {
  domain: {
    name: string;
    version: string;
    chainId: number;
  };
  types: {
    Auth: Array<{ name: string; type: string }>;
  };
  primaryType: string;
  message: {
    wallet: string;
    nonce: string;
    message: string;
  };
}

export const authResolver = {
  Query: {
    me: async (_: any, __: any, context: Context) => {
      try {
        const { address } = await context.auth();
        metrics.increment('gateway.query.me.success');
        return { address };
      } catch (error: any) {
        logger.error(`Me query failed: ${error.message}`);
        metrics.increment('gateway.query.me.failure');
        throw error;
      }
    },
  },

  Mutation: {
    getAuthMessage: async (
      _: any,
      { address }: { address: string },
      context: Context
    ): Promise<SignatureRequest> => {
      try {
        const result = await context.dataSources.authAPI.getAuthMessage(address);
        if (!result) {
          throw new Error('Failed to get auth message');
        }
        metrics.increment('gateway.mutation.getAuthMessage.success');
        return result;
      } catch (error: any) {
        logger.error(`GetAuthMessage mutation failed: ${error.message}`);
        metrics.increment('gateway.mutation.getAuthMessage.failure');
        throw error;
      }
    },

    authenticate: async (
      _: any,
      { address, signature }: { address: string; signature: string },
      context: Context
    ) => {
      try {
        const token = await context.dataSources.authAPI.verifySignature(address, signature);
        if (!token) {
          throw new Error('No token received');
        }
        metrics.increment('gateway.mutation.authenticate.success');
        return { token };
      } catch (error: any) {
        logger.error(`Authentication mutation failed: ${error.message}`);
        metrics.increment('gateway.mutation.authenticate.failure');
        throw new Error(error.message || 'Authentication failed');
      }
    },
  },
};
