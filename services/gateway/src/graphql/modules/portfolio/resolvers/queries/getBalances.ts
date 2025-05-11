import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getBalances: QueryResolvers['getBalances'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting balances', { input });

  const response = await clients.portfolioClient.getBalances.post({
    owners: input.owners,
    tokenAddresses: input.tokenAddresses,
    chainIds: input.chainIds,
    pagination: input.pagination,
  });

  if (response.error) {
    logger.error('Failed to get balances:', response.error);
    throw new Error('Failed to get balances');
  }

  const { data } = response;

  return data.map(balance => ({
    id: balance.id,
    owner: balance.owner,
    tokenAddress: balance.tokenAddress,
    chainId: balance.chainId,
    balance: balance.balance,
    lastUpdateBlock: balance.lastUpdateBlock,
    createdAt: balance.createdAt,
    updatedAt: balance.updatedAt
  }));
};