import { Elysia, t } from 'elysia';
import { AppError } from '@shared/errors/app-errors';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { extractFromToken } from '../utils/jwt.utils';
import { filesClient, documentsClient } from '../clients/eden.clients';
import { ownershipService } from '../services/services.init';
import { CONFIG } from '../config';

export const uploadDocumentController = new Elysia({ name: 'UploadDocumentController' })
  .onError(ErrorHandlerPlugin)
  .post(
    '/api/documents/createDocument',
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

      const { file, folderId, name } = body;

      // Validate file MIME type — same as createDocument resolver
      const mimeType = file.type.split(';')[0].trim();
      if (!CONFIG.FILE_VALIDATION.DOCUMENTS_ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new AppError({
          message: `File type "${mimeType}" is not allowed. Allowed types: ${CONFIG.FILE_VALIDATION.DOCUMENTS_ALLOWED_MIME_TYPES.join(', ')}`,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }

      // Get folder info — same as createDocument resolver
      const folderResponse = await documentsClient.getFolder.post({ id: folderId });
      if (folderResponse.error) {
        throw new AppError({ message: 'Failed to get folder data', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      const folder = folderResponse.data;

      // Ownership check — same as createDocument resolver
      await ownershipService.checkOwnership({
        userId: user.id,
        ownerId: folder.ownerId,
        ownerType: folder.ownerType,
        permission: 'content',
      });

      // Upload file to files service
      const fileResponse = await filesClient.createFile.post({ file });
      if (fileResponse.error) {
        throw new AppError({ message: 'Failed to upload file', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      // Create document with file link
      const response = await documentsClient.createDocument.post({
        folderId,
        name,
        fileId: fileResponse.data.id,
        path: fileResponse.data.path,
        mimeType: fileResponse.data.mimeType,
        size: fileResponse.data.size,
        ownerId: folder.ownerId,
        ownerType: folder.ownerType,
        creator: user.id,
        parentId: folder.parentId,
        grandParentId: folder.grandParentId,
      });

      if (response.error) {
        // Compensation: delete uploaded file if document creation failed
        await filesClient.deleteFile.post({ id: fileResponse.data.id });
        throw new AppError({ message: 'Failed to create document', statusCode: 502, code: 'BAD_GATEWAY' });
      }

      const { data } = response;

      return {
        id: data.id,
        folderId: data.folderId,
        name: data.name,
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
        folderId: t.String(),
        name: t.String(),
      }),
      response: t.Object({
        id: t.String(),
        folderId: t.String(),
        name: t.String(),
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