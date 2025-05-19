import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getRawPriceData: QueryResolvers['getRawPriceData'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting raw price data', { input });

  const response = await clients.chartsClient.getRawPriceData.post({
    poolAddress: input.poolAddress,
    startTime: input.startTime,
    endTime: input.endTime,
    limit: input.limit,
    offset: input.offset,
    sort: input.sort || {},
  });

  if (response.error) {
    logger.error('Failed to get raw price data:', response.error);
    throw new Error('Failed to get raw price data');
  }

  const { data } = response;

  return data.map(priceData => ({
    id: priceData.id,
    poolAddress: priceData.poolAddress,
    timestamp: priceData.timestamp,
    blockNumber: priceData.blockNumber,
    realHoldReserve: priceData.realHoldReserve,
    virtualHoldReserve: priceData.virtualHoldReserve,
    virtualRwaReserve: priceData.virtualRwaReserve,
    price: priceData.price,
    createdAt: priceData.createdAt,
    updatedAt: priceData.updatedAt,
  }));
};