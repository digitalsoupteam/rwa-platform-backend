import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getPoolTransactions: QueryResolvers['getPoolTransactions'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting pool transactions', { input });

  const response = await clients.chartsClient.getPoolTransactions.post({
    filter: input?.filter || {},
    sort: input?.sort || {},
    limit: input?.limit,
    offset: input?.offset,
  });

  if (response.error) {
    logger.error('Failed to get pool transactions:', response.error);
    throw new Error('Failed to get pool transactions');
  }

  const { data } = response;

  return data.map(tx => ({
    id: tx.id,
    poolAddress: tx.poolAddress,
    transactionType: tx.transactionType,
    userAddress: tx.userAddress,
    timestamp: tx.timestamp,
    rwaAmount: tx.rwaAmount,
    holdAmount: tx.holdAmount,
    bonusAmount: tx.bonusAmount,
    holdFee: tx.holdFee,
    bonusFee: tx.bonusFee,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt
  }));
};