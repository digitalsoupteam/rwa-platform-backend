import { QueryResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/logger';

export const getBusinesses: QueryResolvers['getBusinesses'] = async (
  _parent,
  { input },
  { clients }
) => {
  logger.info('Getting businesses list', { input });

  console.log('inputinputinput')
  console.log(input)

  const response = await clients.rwaClient.getBusinesses.post({
    filter: input.filter,
    sort: input.sort,
    limit: input.limit,
    offset: input.offset,
  });

  if (response.error) {
    logger.error('Failed to get businesses:', response.error);
    throw new Error('Failed to get businesses');
  }

  const { data } = response;

  return data.map(business => ({
    id: business.id,
    chainId: business.chainId,
    name: business.name,
    ownerId: business.ownerId,
    ownerType: business.ownerType,
    ownerWallet: business.ownerWallet,
    tokenAddress: business.tokenAddress,
    description: business.description,
    tags: business.tags,
    riskScore: business.riskScore,
    image: business.image,
    approvalSignaturesTaskId: business.approvalSignaturesTaskId,
    approvalSignaturesTaskExpired: business.approvalSignaturesTaskExpired,
    paused: business.paused,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  }));
};