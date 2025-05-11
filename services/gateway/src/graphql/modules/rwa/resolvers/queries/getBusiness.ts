import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getBusiness: QueryResolvers['getBusiness'] = async (
  _parent,
  { id },
  { clients }
) => {
  logger.info('Getting business by id', { id });

  const response = await clients.rwaClient.getBusiness.post({
    id
  });

  if (response.error) {
    logger.error('Failed to get business:', response.error);
    throw new Error('Failed to get business');
  }

  const business = response.data;

  return {
    id: business.id,
    chainId: business.chainId,
    name: business.name,
    ownerId: business.ownerId,
    ownerType: business.ownerType,
    tokenAddress: business.tokenAddress,
    description: business.description,
    tags: business.tags,
    riskScore: business.riskScore,
    image: business.image,
    generationCount: business.generationCount,
    approvalSignaturesTaskId: business.approvalSignaturesTaskId,
    approvalSignaturesTaskExpired: business.approvalSignaturesTaskExpired,
    paused: business.paused,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  };
};