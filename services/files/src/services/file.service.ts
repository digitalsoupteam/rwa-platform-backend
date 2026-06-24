import { FileRepository } from "../repositories/file.repository";
import { StorageClient } from "../clients/storage.client";
import { TraceDecorator } from "@shared/monitoring/src/traceDecorator";
import { MetricsDecorator } from "@shared/monitoring/src/metricsDecorator";
import { LogDecorator } from "@shared/monitoring/src/logDecorator";
import { setSpanAttributes } from "@shared/monitoring/src/tracing";
import { AppError } from "@shared/errors/app-errors";


export class FileService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageClient: StorageClient
  ) {}

  /**
   * Creates a new file record and saves file to disk
   */
  @TraceDecorator()
  @MetricsDecorator()
  @LogDecorator()
  async createFile(data: {
    file: File;
  }) {
    setSpanAttributes({
      mimeType: data.file.type,
    });
    const buffer = await data.file.arrayBuffer();
    const storagePath = this.storageClient.generatePath(data.file.name);

    // Save file to storage
    await this.storageClient.saveFile(storagePath, Buffer.from(buffer));

    const file = await this.fileRepository.create({
      name: data.file.name,
      path: storagePath,
      size: data.file.size,
      mimeType: data.file.type,
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
  @LogDecorator({ args: ['id'] })
  async getFile(id: string) {
    setSpanAttributes({
      fileId: id,
    });
    const file = await this.fileRepository.findById(id);

    if (!this.storageClient.fileExists(file.path)) {
      throw new AppError({ message: "Physical file not found", statusCode: 404, code: "NOT_FOUND" });
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
  @LogDecorator({ args: ['path'] })
  async getFileByPath(path: string) {
    setSpanAttributes({
      path,
    });
    const file = await this.fileRepository.findByPath(path);

    if (!this.storageClient.fileExists(file.path)) {
      throw new AppError({ message: "Physical file not found", statusCode: 404, code: "NOT_FOUND" });
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
  @LogDecorator({ args: ['id', 'data'] })
  async updateFile(id: string, data: {
    name?: string;
    metadata?: Record<string, any>;
  }) {
    setSpanAttributes({
      fileId: id,
    });
    const file = await this.fileRepository.update(id, data);

    if (!this.storageClient.fileExists(file.path)) {
      throw new AppError({ message: "Physical file not found", statusCode: 404, code: "NOT_FOUND" });
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
  @LogDecorator({ args: ['id'] })
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