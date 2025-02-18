import { RabbitMQClient } from '@rwa-platform/shared/src/utils/rabbitmq';
import { logger, metrics } from '@rwa-platform/shared/src';
import { EnterpriseAPI } from '../datasources/enterprise.datasource';

interface Context {
  dataSources: {
    enterpriseAPI: EnterpriseAPI;
  };
  auth: () => Promise<{ address: string }>;
}

export const enterpriseResolvers = {
  Query: {
    enterprises: async (_: any, __: any, { dataSources }: Context) => {
      const result = await dataSources.enterpriseAPI.getEnterprises();
      metrics.increment('gateway.enterprise.query.list');
      return result;
    },
    enterprise: async (_: any, { id }: { id: string }, { dataSources }: Context) => {
      const result = await dataSources.enterpriseAPI.getEnterprise(id);
      metrics.increment('gateway.enterprise.query.get');
      return result;
    },
    pools: async (_: any, __: any, { dataSources }: Context) => {
      const result = await dataSources.enterpriseAPI.getPools();
      metrics.increment('gateway.pool.query.list');
      return result;
    },
    pool: async (_: any, { id }: { id: string }, { dataSources }: Context) => {
      const result = await dataSources.enterpriseAPI.getPool(id);
      metrics.increment('gateway.pool.query.get');
      return result;
    },
  },

  Mutation: {
    createEnterprise: async (_: any, { input }: any, { dataSources, auth }: Context) => {
      const { address } = await auth();
      const enterprise = await dataSources.enterpriseAPI.createEnterprise({
        ...input,
        productOwner: address
      });
      metrics.increment('gateway.enterprise.mutation.create');
      return enterprise;
    },

    requestSignatures: async (_: any, { enterpriseId }: any, { dataSources, auth }: Context) => {
      const { address } = await auth();
      const enterprise = await dataSources.enterpriseAPI.getEnterprise(enterpriseId);
      
      if (enterprise.productOwner !== address) {
        throw new Error('Only product owner can request signatures');
      }

      const result = await dataSources.enterpriseAPI.requestSignatures(enterpriseId);
      metrics.increment('gateway.enterprise.mutation.requestSignatures');
      return result;
    },

    createPool: async (_: any, { enterpriseId, input }: any, { dataSources, auth }: Context) => {
      const { address } = await auth();
      const enterprise = await dataSources.enterpriseAPI.getEnterprise(enterpriseId);
      
      if (enterprise.productOwner !== address) {
        throw new Error('Only product owner can create pools');
      }

      const result = await dataSources.enterpriseAPI.createPool(enterpriseId, input);
      metrics.increment('gateway.pool.mutation.create');
      return result;
    },
  },

  Subscription: {
    enterpriseUpdated: {
      subscribe: async (_: any, { id }: { id: string }) => {
        const rabbitmq = new RabbitMQClient({
          url: process.env.RABBITMQ_URL || 'amqp://localhost'
        });
        await rabbitmq.connect();

        logger.info(`Subscribed to enterprise updates for ${id}`);

        return {
          [Symbol.asyncIterator]: () => {
            return rabbitmq.getChannel()!.consume(`enterprise.updates.${id}`, msg => {
              if (msg) {
                rabbitmq.getChannel()!.ack(msg);
                return JSON.parse(msg.content.toString());
              }
            });
          }
        };
      }
    },

    enterpriseSignaturesUpdated: {
      subscribe: async (_: any, { id }: { id: string }) => {
        const rabbitmq = new RabbitMQClient({
          url: process.env.RABBITMQ_URL || 'amqp://localhost'
        });
        await rabbitmq.connect();

        logger.info(`Subscribed to enterprise signature updates for ${id}`);

        return {
          [Symbol.asyncIterator]: () => {
            return rabbitmq.getChannel()!.consume(`enterprise.signatures.${id}`, msg => {
              if (msg) {
                rabbitmq.getChannel()!.ack(msg);
                return JSON.parse(msg.content.toString());
              }
            });
          }
        };
      }
    }
  },

  Enterprise: {
    pools: async (parent: any, _: any, { dataSources }: Context) => {
      if (!parent.pools?.length) return [];
      const pools = await Promise.all(
        parent.pools.map((poolId: string) => dataSources.enterpriseAPI.getPool(poolId))
      );
      metrics.increment('gateway.enterprise.field.pools');
      return pools;
    },
  },

  Pool: {
    rwaEnterprise: async (parent: any, _: any, { dataSources }: Context) => {
      const enterprise = await dataSources.enterpriseAPI.getEnterprise(parent.rwaEnterprise);
      metrics.increment('gateway.pool.field.enterprise');
      return enterprise;
    },
  },
};
