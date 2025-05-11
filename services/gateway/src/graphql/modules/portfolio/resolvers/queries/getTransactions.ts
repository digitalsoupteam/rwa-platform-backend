import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getTransactions: QueryResolvers['getTransactions'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting transactions', { input });

  const response = await clients.portfolioClient.getTransactions.post({
    from: input.from,
    to: input.to,
    tokenAddresses: input.tokenAddresses,
    chainIds: input.chainIds,
    blockNumbers: input.blockNumbers,
    pagination: input.pagination,
  });

  if (response.error) {
    logger.error('Failed to get transactions:', response.error);
    throw new Error('Failed to get transactions');
  }

  const { data } = response;

  return data.map(transaction => ({
    id: transaction.id,
    from: transaction.from,
    to: transaction.to,
    tokenAddress: transaction.tokenAddress,
    tokenId: transaction.tokenId,
    chainId: transaction.chainId,
    transactionHash: transaction.transactionHash,
    blockNumber: transaction.blockNumber,
    amount: transaction.amount,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
  }));
};