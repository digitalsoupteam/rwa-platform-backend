import { FileRepository } from '../repositories/file.repository';
import { StorageClient } from '../clients/storage.client';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';
import { MetricsDecorator } from '@shared/monitoring/src/metricsDecorator';
import { LogDecorator } from '@shared/monitoring/src/logDecorator';
import { setSpanAttributes } from '@shared/monitoring/src/tracing';
import { AppError } from '@shared/errors/app-errors';
import { fileTypeFromBuffer } from 'file-type';

// Allowed file types. Key — MIME detected from content (magic bytes), value — canonical extension.
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export class FileService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageClient: StorageClient,
  ) {}

  /**
   * Creates a new file record and saves file to disk
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator()
  async createFile(data: { file: File }) {
    setSpanAttributes({
      mimeType: data.file.type,
    });
    const buffer = Buffer.from(await data.file.arrayBuffer());

    // The content decides: type and extension are derived from magic bytes only.
    // Undetectable content, a type outside the allowed set, or a mismatch with the
    // declared type is rejected — the client-provided type is never trusted.
    const detected = await fileTypeFromBuffer(buffer);
    const declared = data.file.type.split(';')[0].trim().toLowerCase();
    const extension = detected ? EXTENSION_BY_MIME[detected.mime] : undefined;

    if (!detected || !extension || detected.mime !== declared) {
      throw new AppError({
        message: 'File type is not allowed',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const relativePath = this.storageClient.generatePath(extension);

    // Save file to storage
    await this.storageClient.saveFile(relativePath, buffer);

    const file = await this.fileRepository.create({
      name: data.file.name,
      path: relativePath,
      size: data.file.size,
      mimeType: detected.mime,
    });

    return {
      id: file._id.toString(),
      name: file.name,
      path: file.path,
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  /**
   * Gets file by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async getFile(id: string) {
    setSpanAttributes({
      fileId: id,
    });
    const file = await this.fileRepository.findById(id);

    if (!this.storageClient.fileExists(file.path)) {
      throw new AppError({
        message: 'Physical file not found',
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return {
      id: file._id.toString(),
      name: file.name,
      path: file.path,
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  /**
   * Gets file by path
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ path: a[0] }),
  })
  async getFileByPath(path: string) {
    setSpanAttributes({
      path,
    });
    const file = await this.fileRepository.findByPath(path);

    if (!this.storageClient.fileExists(file.path)) {
      throw new AppError({
        message: 'Physical file not found',
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return {
      id: file._id.toString(),
      name: file.name,
      path: file.path,
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  /**
   * Updates file metadata
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0], name: a[1].name }),
  })
  async updateFile(
    id: string,
    data: {
      name?: string;
      metadata?: Record<string, any>;
    },
  ) {
    setSpanAttributes({
      fileId: id,
    });
    const file = await this.fileRepository.update(id, data);

    if (!this.storageClient.fileExists(file.path)) {
      throw new AppError({
        message: 'Physical file not found',
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }

    return {
      id: file._id.toString(),
      name: file.name,
      path: file.path,
      size: file.size,
      mimeType: file.mimeType,
    };
  }

  /**
   * Deletes file record and physical file by ID
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator({
    args: (a) => ({ id: a[0] }),
  })
  async deleteFile(id: string) {
    setSpanAttributes({
      fileId: id,
    });
    const file = await this.fileRepository.findById(id);
    await this.storageClient.deleteFile(file.path);
    await this.fileRepository.delete(id);

    return { id };
  }
}
