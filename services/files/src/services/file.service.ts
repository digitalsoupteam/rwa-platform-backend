import { logger } from "@shared/monitoring/src/logger";
import { FileRepository } from "../repositories/file.repository";
import { StorageClient } from "../clients/storage.client";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class FileService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageClient: StorageClient
  ) {}

  /**
   * Creates a new file record and saves file to disk
   */
  async createFile(data: {
    file: File;
  }) {
    const buffer = await data.file.arrayBuffer();
    const storagePath = this.storageClient.generatePath(data.file.name);

    logger.debug("Creating new file", {
      name: data.file.name,
      size: data.file.size,
      type: data.file.type
    });

    // Save file to storage
    await this.storageClient.saveFile(storagePath, Buffer.from(buffer));

    console.log('file.metadata1')
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
  async getFile(id: string) {
    logger.debug("Getting file", { id });
    
    const file = await this.fileRepository.findById(id);

    if (!this.storageClient.fileExists(file.path)) {
      logger.error("Physical file not found", { path: file.path });
      throw new Error("Physical file not found");
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
  async getFileByPath(path: string) {
    logger.debug("Getting file by path", { path });
    
    const file = await this.fileRepository.findByPath(path);

    if (!this.storageClient.fileExists(file.path)) {
      logger.error("Physical file not found", { path: file.path });
      throw new Error("Physical file not found");
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
  async updateFile(id: string, data: {
    name?: string;
    metadata?: Record<string, any>;
  }) {
    logger.debug("Updating file metadata", { id });

    const file = await this.fileRepository.update(id, data);

    if (!this.storageClient.fileExists(file.path)) {
      logger.error("Physical file not found", { path: file.path });
      throw new Error("Physical file not found");
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
  async deleteFile(id: string) {
    logger.debug("Deleting file", { id });
    
    const file = await this.fileRepository.findById(id);
    await this.storageClient.deleteFile(file.path);
    await this.fileRepository.delete(id);
    
    return { id };
  }
}
