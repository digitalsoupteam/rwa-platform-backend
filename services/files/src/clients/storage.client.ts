import { existsSync, mkdirSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "@shared/monitoring/src/logger";
import { TracingDecorator } from "@shared/monitoring/src/tracingDecorator";

@TracingDecorator()
export class StorageClient {
  constructor(private readonly rootDir: string) {
    // Ensure root directory exists
    if (!existsSync(rootDir)) {
      mkdirSync(rootDir, { recursive: true });
      logger.info(`Created storage root directory: ${rootDir}`);
    }
  }

  /**
   * Generates a unique file path within storage
   */
  generatePath(originalName: string): string {
    const uuid = randomUUID();
    const ext = originalName.split('.').pop() || '';
    return join(this.rootDir, `${uuid}.${ext}`);
  }

  /**
   * Saves file data to disk
   */
  async saveFile(path: string, data: Buffer): Promise<void> {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await writeFile(path, data);
    logger.debug(`Saved file to: ${path}`);
  }

  /**
   * Deletes file from disk
   */
  async deleteFile(path: string): Promise<void> {
    if (!existsSync(path)) {
      logger.warn(`File not found for deletion: ${path}`);
      return;
    }

    await unlink(path);
    logger.debug(`Deleted file: ${path}`);
  }

  /**
   * Checks if file exists
   */
  fileExists(path: string): boolean {
    return existsSync(path);
  }
}