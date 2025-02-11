import { logger, metrics } from '@rwa-platform/shared/src';
import { AuthAPI } from 'src/datasources/auth.api';

interface Context {
  dataSources: {
    authAPI: AuthAPI;
  };
  auth: () => Promise<{ address: string }>;
}
export interface TypedDataResponse {
  nonce: string;
  typedData: {
    domain: {
      name: string;
      version: string;
      chainId: number;
    };
    primaryType: string;
    types: {
      EIP712Domain: Array<{ name: string; type: string }>;
      Message: Array<{ name: string; type: string }>;
    };
    message: {
      wallet: string;
      nonce: string;
      message: string;
    };
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
    getNonce: async (
      _: any,
      { address }: { address: string },
      context: Context
    ): Promise<TypedDataResponse> => {
      try {
        const result = await context.dataSources.authAPI.getNonce(address);
        metrics.increment('gateway.mutation.getNonce.success');
        return result;
      } catch (error: any) {
        logger.error(`GetNonce mutation failed: ${error.message}`);
        metrics.increment('gateway.mutation.getNonce.failure');
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
        return { token, address };
      } catch (error: any) {
        logger.error(`Authentication mutation failed: ${error.message}`);
        metrics.increment('gateway.mutation.authenticate.failure');
        throw error;
      }
    },
  },
};
