import { AuthenticationError } from "@shared/errors/app-errors";
import { QueryResolvers } from "../../../../generated/types";
import { logger } from "@shared/monitoring/src/logger";

export const getSignatureTask: QueryResolvers["getSignatureTask"] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.info("Getting signature task", { taskId: input.taskId });

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  const response = await clients.signersManagerClient.getSignatureTask.post({
    taskId: input.taskId,
  });

  if (response.error) {
    logger.error("Failed to get signature task:", response.error);
    throw new Error("Failed to get signature task");
  }

  const signatureTask = response.data
  
  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: signatureTask.ownerId,
    ownerType: signatureTask.ownerType,
    permission: 'deploy'
  })

  return signatureTask;
};
