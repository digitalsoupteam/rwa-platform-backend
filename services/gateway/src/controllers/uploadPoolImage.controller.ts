import { Elysia, t } from 'elysia';
import { AppError } from '@shared/errors/app-errors';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { userResolverService } from '../services/services.init';
import { filesClient, rwaClient } from '../clients/eden.clients';
import { ownershipService } from '../services/services.init';
import { CONFIG } from '../config';

export const uploadPoolImageController = new Elysia({ name: 'UploadPoolImageController' })
  .onError(ErrorHandlerPlugin)
  .post(
    '/api/pool/uploadImage',
    async ({ request, body }) => {
      // Auth
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.split(' ')[1] ?? null;
      if (!token) {
        throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
      }

      const extracted = await userResolverService.resolveUser(token);
      if (!extracted) {
        throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
      }
      const user = { id: extracted.userId, wallet: extracted.wallet };

      const { file, poolId } = body;

      // Validate file MIME type
      const mimeType = file.type.split(';')[0].trim();
      if (!CONFIG.FILE_VALIDATION.TOKEN_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new AppError({
          message: `File type "${mimeType}" is not allowed. Allowed types: ${CONFIG.FILE_VALIDATION.TOKEN_IMAGE_ALLOWED_MIME_TYPES.join(', ')}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      // Get pool to check ownership
      const poolResponse = await rwaClient.getPool.post({ id: poolId });
      if (poolResponse.error) {
        throw new AppError({ message: 'Failed to get pool data', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      const pool = poolResponse.data;

      // Ownership check
      await ownershipService.checkOwnership({
        userId: user.id,
        ownerId: pool.ownerId,
        ownerType: pool.ownerType,
        permission: 'content',
      });

      // Upload file to files service
      const fileResponse = await filesClient.createFile.post({ file });
      if (fileResponse.error) {
        throw new AppError({ message: 'Failed to upload file', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      // Save relative path in DB, RWA service returns full URL via mapPool
      const imagePath = fileResponse.data.path;

      const response = await rwaClient.updatePoolImage.post({
        id: poolId,
        image: imagePath,
        fileId: fileResponse.data.id,
      });

      if (response.error) {
        // Compensation: delete uploaded file if update failed
        await filesClient.deleteFile.post({ id: fileResponse.data.id });
        throw new AppError({ message: 'Failed to update pool image', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      return {
        id: response.data.id,
        image: response.data.image,
        imageUrl: response.data.imageUrl ?? '',
      };
    },
    {
      body: t.Object({
        file: t.File(),
        poolId: t.String(),
      }),
      response: t.Object({
        id: t.String(),
        image: t.Optional(t.String()),
        imageUrl: t.String(),
      }),
    },
  );
