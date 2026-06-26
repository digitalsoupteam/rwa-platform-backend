import { AppError } from "@shared/errors/app-errors";
import type { MutationResolvers } from '../../../../generated/types';
import { logger } from '@shared/monitoring/src/monitoring.plugin';

export const updateBlog: MutationResolvers['updateBlog'] = async (
  _parent,
  { input },
  { services, clients, user }
) => {
  logger.debug('Updating blog', { input });

  if (!user) {
    throw new AppError({ message: "Authentication required", statusCode: 401, code: "UNAUTHORIZED" });
  }

  // Get blog first to check permissions
  const blogResponse = await clients.blogClient.getBlog.post({
    id: input.id
  });

  if (blogResponse.error) {
    logger.error('Failed to get blog:', blogResponse.error);
    throw new AppError({ message: 'Failed to get blog data', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const blog = blogResponse.data;

  await services.ownership.checkOwnership({
    userId: user.id,
    ownerId: blog.ownerId,
    ownerType: blog.ownerType,
    permission: 'content'
  });

  const response = await clients.blogClient.updateBlog.post({
    id: input.id,
    updateData: input.updateData
  });

  if (response.error) {
    logger.error('Failed to update blog:', response.error);
    throw new AppError({ message: 'Failed to update blog', statusCode: 502, code: "BAD_GATEWAY" });
  }

  const { data } = response;

  return {
    id: data.id,
    name: data.name,
    ownerId: data.ownerId,
    ownerType: data.ownerType,
    creator: data.creator,
    parentId: data.parentId,
    grandParentId: data.grandParentId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};
