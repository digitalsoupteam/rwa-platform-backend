import { existsSync, mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TraceDecorator } from '@shared/monitoring/src/traceDecorator';

export class StorageClient {
  constructor(private readonly rootDir: string) {
    // Ensure root directory exists
    if (!existsSync(rootDir)) {
      mkdirSync(rootDir, { recursive: true });
    }
  }

  /**
   * Generates a unique file path within storage
   */
  @TraceDecorator()
  generatePath(originalName: string): string {
    const uuid = randomUUID();
    const ext = originalName.split('.').pop() || '';
    return join(this.rootDir, `${uuid}.${ext}`);
  }

  /**
   * Saves file data to disk
   */
  @TraceDecorator()
  async saveFile(path: string, data: Buffer): Promise<void> {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await writeFile(path, data);
  }

  /**
   * Deletes file from disk
   */
  @TraceDecorator()
  async deleteFile(path: string): Promise<void> {
    if (!existsSync(path)) {
      return;
    }

    await unlink(path);
  }

  /**
   * Checks if file exists
   */
  @TraceDecorator()
  fileExists(path: string): boolean {
    return existsSync(path);
  }
}
