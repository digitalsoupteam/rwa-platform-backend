import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const requestBusinessApprovalSignatures: MutationResolvers['requestBusinessApprovalSignatures'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.debug('Requesting business approval signatures', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Get business first to check permissions
  const businessResponse = await clients.rwaClient.getBusiness.post({
    id: input.id
  });

  if (businessResponse.error) {
    logger.error('Failed to get business:', businessResponse.error);
    throw new AppError({ message: 'Failed to get business data', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const business = businessResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: business.ownerId,
    ownerType: business.ownerType,
    permission: 'deploy'
  });

  const response = await clients.rwaClient.requestBusinessApprovalSignatures.post({
    id: input.id,
    ownerWallet: input.ownerWallet,
    deployerWallet: input.deployerWallet,
    createRWAFee: input.createRWAFee,
  });

  if (response.error) {
    logger.error('Failed to request business approval signatures:', response.error);
    throw new AppError({ message: 'Failed to request business approval signatures', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return data;
};
