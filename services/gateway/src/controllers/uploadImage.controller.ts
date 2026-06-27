import { Elysia, t } from 'elysia';
import { AppError } from '@shared/errors/app-errors';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { extractFromToken } from '../utils/jwt.utils';
import { filesClient, galleryClient } from '../clients/eden.clients';
import { ownershipService } from '../services/services.init';
import { CONFIG } from '../config';

export const uploadImageController = new Elysia({ name: 'UploadImageController' })
  .onError(ErrorHandlerPlugin)
  .post(
    '/api/gallery/createImage',
    async ({ request, body }) => {
      // Auth — same as yoga context()
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.split(' ')[1] ?? null;
      if (!token) {
        throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
      }

      const extracted = extractFromToken(token);
      if (!extracted) {
        throw new AppError({ message: 'Authentication required', statusCode: 401, code: 'UNAUTHORIZED' });
      }
      const user = { id: extracted.userId, wallet: extracted.wallet };

      const { file, galleryId, name, description } = body;

      // Validate file MIME type — same as createImage resolver
      const mimeType = file.type.split(';')[0].trim();
      if (!CONFIG.FILE_VALIDATION.GALLERY_ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new AppError({
          message: `File type "${mimeType}" is not allowed. Allowed types: ${CONFIG.FILE_VALIDATION.GALLERY_ALLOWED_MIME_TYPES.join(', ')}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      // Get gallery info — same as createImage resolver
      const galleryResponse = await galleryClient.getGallery.post({ id: galleryId });
      if (galleryResponse.error) {
        throw new AppError({ message: 'Failed to get gallery data', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      const gallery = galleryResponse.data;

      // Ownership check — same as createImage resolver
      await ownershipService.checkOwnership({
        userId: user.id,
        ownerId: gallery.ownerId,
        ownerType: gallery.ownerType,
        permission: 'content',
      });

      // Upload file to files service
      const fileResponse = await filesClient.createFile.post({ file });
      if (fileResponse.error) {
        throw new AppError({ message: 'Failed to upload file', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      // Create image with file link
      const response = await galleryClient.createImage.post({
        galleryId,
        name,
        description,
        fileId: fileResponse.data.id,
        path: fileResponse.data.path,
        mimeType: fileResponse.data.mimeType,
        size: fileResponse.data.size,
        ownerId: gallery.ownerId,
        ownerType: gallery.ownerType,
        creator: user.id,
        parentId: gallery.parentId,
        grandParentId: gallery.grandParentId,
      });

      if (response.error) {
        // Compensation: delete uploaded file if image creation failed
        await filesClient.deleteFile.post({ id: fileResponse.data.id });
        throw new AppError({ message: 'Failed to create image', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      const { data } = response;

      return {
        id: data.id,
        galleryId: data.galleryId,
        name: data.name,
        description: data.description,
        fileId: data.fileId,
        path: data.path,
        url: data.url,
        mimeType: data.mimeType,
        size: data.size,
        ownerId: data.ownerId,
        ownerType: data.ownerType,
        creator: data.creator,
        parentId: data.parentId,
        grandParentId: data.grandParentId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    },
    {
      body: t.Object({
        file: t.File(),
        galleryId: t.String(),
        name: t.String(),
        description: t.String(),
      }),
      response: t.Object({
        id: t.String(),
        galleryId: t.String(),
        name: t.String(),
        description: t.String(),
        fileId: t.String(),
        path: t.String(),
        url: t.String(),
        mimeType: t.String(),
        size: t.Number(),
        ownerId: t.String(),
        ownerType: t.String(),
        creator: t.String(),
        parentId: t.String(),
        grandParentId: t.String(),
        createdAt: t.Number(),
        updatedAt: t.Number(),
      }),
    },
  );