import { Elysia, t } from 'elysia';
import { AppError } from '@shared/errors/app-errors';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { userResolverService } from '../services/services.init';
import { filesClient, rwaClient } from '../clients/eden.clients';
import { ownershipService } from '../services/services.init';
import { CONFIG } from '../config';

export const uploadBusinessImageController = new Elysia({ name: 'UploadBusinessImageController' })
  .onError(ErrorHandlerPlugin)
  .post(
    '/api/business/uploadImage',
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

      const { file, businessId } = body;

      // Validate file MIME type
      const mimeType = file.type.split(';')[0].trim();
      if (!CONFIG.FILE_VALIDATION.TOKEN_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new AppError({
          message: `File type "${mimeType}" is not allowed. Allowed types: ${CONFIG.FILE_VALIDATION.TOKEN_IMAGE_ALLOWED_MIME_TYPES.join(', ')}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      // Get business to check ownership
      const businessResponse = await rwaClient.getBusiness.post({ id: businessId });
      if (businessResponse.error) {
        throw new AppError({ message: 'Failed to get business data', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      const business = businessResponse.data;

      // Ownership check
      await ownershipService.checkOwnership({
        userId: user.id,
        ownerId: business.ownerId,
        ownerType: business.ownerType,
        permission: 'content',
      });

      // Upload file to files service
      const fileResponse = await filesClient.createFile.post({ file });
      if (fileResponse.error) {
        throw new AppError({ message: 'Failed to upload file', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      // Update business image
      const imageUrl = fileResponse.data.path;

      const response = await rwaClient.updateBusinessImage.post({
        id: businessId,
        image: imageUrl,
      });

      if (response.error) {
        // Compensation: delete uploaded file if update failed
        await filesClient.deleteFile.post({ id: fileResponse.data.id });
        throw new AppError({ message: 'Failed to update business image', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      return {
        id: response.data.id,
        image: response.data.image,
        url: imageUrl,
      };
    },
    {
      body: t.Object({
        file: t.File(),
        businessId: t.String(),
      }),
      response: t.Object({
        id: t.String(),
        image: t.Optional(t.String()),
        url: t.String(),
      }),
    },
  );
