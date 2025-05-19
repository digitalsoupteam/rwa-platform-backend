import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getOhlcPriceData: QueryResolvers['getOhlcPriceData'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting OHLC price data', { input });

  const response = await clients.chartsClient.getOhlcPriceData.post({
    poolAddress: input.poolAddress,
    interval: input.interval as any,
    startTime: input.startTime,
    endTime: input.endTime,
    limit: input.limit,
  });

  if (response.error) {
    logger.error('Failed to get OHLC price data:', response.error);
    throw new Error('Failed to get OHLC price data');
  }

  const { data } = response;

  return data.map(ohlcData => ({
    timestamp: ohlcData.timestamp,
    open: ohlcData.open,
    high: ohlcData.high,
    low: ohlcData.low,
    close: ohlcData.close,
  }));
};