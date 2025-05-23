import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getVolumeData: QueryResolvers['getVolumeData'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting volume data', { input });

  const response = await clients.chartsClient.getVolumeData.post({
    poolAddress: input.poolAddress,
    interval: input.interval as any,
    startTime: input.startTime,
    endTime: input.endTime,
    limit: input.limit,
  });

  if (response.error) {
    logger.error('Failed to get volume data:', response.error);
    throw new Error('Failed to get volume data');
  }

  const { data } = response;

  return data.map(volumeData => ({
    timestamp: volumeData.timestamp,
    mintVolume: volumeData.mintVolume,
    burnVolume: volumeData.burnVolume,
  }));
};